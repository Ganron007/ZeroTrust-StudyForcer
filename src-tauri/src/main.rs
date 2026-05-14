#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::env;
use std::fs;
use std::path::PathBuf;
use std::str::FromStr;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Manager, WindowEvent};

// Window-state writes are throttled: a resize/move can fire dozens of times per
// second, and writing plans.json each time burns disk and CPU. We rate-limit to
// at most one write per WINDOW_STATE_THROTTLE; on CloseRequested we flush
// unconditionally so the final position is always saved.
const WINDOW_STATE_THROTTLE: Duration = Duration::from_millis(500);
static LAST_WINDOW_STATE_WRITE: Mutex<Option<Instant>> = Mutex::new(None);

fn persist_window_state(window: &tauri::Window, force: bool) {
    if !force {
        let mut guard = match LAST_WINDOW_STATE_WRITE.lock() {
            Ok(g) => g,
            Err(_) => return,
        };
        let now = Instant::now();
        if let Some(prev) = *guard {
            if now.duration_since(prev) < WINDOW_STATE_THROTTLE {
                return;
            }
        }
        *guard = Some(now);
    }

    let handle = window.app_handle();
    let pos = window
        .outer_position()
        .unwrap_or(tauri::PhysicalPosition { x: 0, y: 0 });
    let size = window
        .outer_size()
        .unwrap_or(tauri::PhysicalSize { width: 1280, height: 800 });
    let is_maximized = window.is_maximized().unwrap_or(false);
    let is_fullscreen = window.is_fullscreen().unwrap_or(false);
    let state = serde_json::json!({
        "x": pos.x,
        "y": pos.y,
        "width": size.width,
        "height": size.height,
        "maximized": is_maximized,
        "fullscreen": is_fullscreen,
    });
    let _ = fs::write(window_state_path(handle), state.to_string());
}

fn app_dir(_handle: &AppHandle) -> PathBuf {
    let mut path = env::current_exe()
        .expect("failed to get current exe path")
        .parent()
        .expect("failed to get exe parent dir")
        .to_path_buf();
    path.push("data");
    if !path.exists() {
        fs::create_dir_all(&path).expect("failed to create data dir");
    }
    path
}

fn courses_dir(handle: &AppHandle) -> PathBuf {
    let mut path = app_dir(handle);
    path.push("courses");
    if !path.exists() {
        fs::create_dir_all(&path).expect("failed to create courses dir");
    }
    path
}

fn logos_dir(handle: &AppHandle) -> PathBuf {
    let mut path = app_dir(handle);
    path.push("logos");
    if !path.exists() {
        fs::create_dir_all(&path).expect("failed to create logos dir");
    }
    path
}

fn timer_path(handle: &AppHandle) -> PathBuf {
    let mut path = app_dir(handle);
    path.push("timer-state.json");
    path
}

fn window_state_path(handle: &AppHandle) -> PathBuf {
    let mut path = app_dir(handle);
    path.push("window-state.json");
    path
}

fn labs_path(handle: &AppHandle) -> PathBuf {
    let mut path = app_dir(handle);
    path.push("labs-log.json");
    path
}

fn news_path(handle: &AppHandle) -> PathBuf {
    let mut path = app_dir(handle);
    path.push("news-cache.json");
    path
}

fn course_path(handle: &AppHandle, course_id: &str) -> PathBuf {
    let mut path = courses_dir(handle);
    path.push(format!("{}.json", course_id));
    path
}

// ── News Feed ───────────────────────────────────────────────────────────────

#[derive(serde::Serialize, serde::Deserialize, Clone)]
struct NewsItem {
    id: String,
    title: String,
    url: String,
    source: String,
    category: String,
    domain: String,
    published_at: String,
    score: i32,
}

#[derive(serde::Serialize, serde::Deserialize)]
struct NewsCache {
    items: Vec<NewsItem>,
    fetched_at: String,
}

struct FeedConfig {
    url: &'static str,
    label: &'static str,
    category: &'static str,
}

const FEEDS: &[FeedConfig] = &[
    FeedConfig { url: "https://www.bleepingcomputer.com/feed/", label: "BleepingComputer", category: "General" },
    FeedConfig { url: "https://feeds.feedburner.com/TheHackersNews", label: "The Hacker News", category: "General" },
    FeedConfig { url: "https://isc.sans.edu/rssfeed_full.xml", label: "SANS ISC", category: "DFIR" },
    FeedConfig { url: "https://0dayfans.com/feed", label: "0dayfans", category: "Vulnerabilities" },
    FeedConfig { url: "https://cyberalerts.io/rss/", label: "Cyber Alerts", category: "General" },
    FeedConfig { url: "https://grahamcluley.com/feed/", label: "Graham Cluley", category: "General" },
    FeedConfig { url: "https://krebsonsecurity.com/feed/", label: "Krebs on Security", category: "Investigative" },
    FeedConfig { url: "https://news.sophos.com/en-us/category/security-operations/feed/", label: "Sophos SecOps", category: "Blue Team" },
    FeedConfig { url: "https://news.sophos.com/en-us/category/threat-research/feed/", label: "Sophos Threat Research", category: "Threat Intel" },
    FeedConfig { url: "https://securelist.com/feed/", label: "Securelist", category: "Malware" },
    FeedConfig { url: "https://www.schneier.com/feed/", label: "Schneier on Security", category: "Policy" },
    FeedConfig { url: "https://www.troyhunt.com/rss/", label: "Troy Hunt", category: "Blue Team" },
    FeedConfig { url: "https://www.usom.gov.tr/rss/duyuru.rss", label: "USOM Notices", category: "Government" },
    FeedConfig { url: "https://www.usom.gov.tr/rss/tehdit.rss", label: "USOM Threats", category: "Government" },
];

fn parse_date(date_str: &str) -> Option<chrono::DateTime<chrono::Utc>> {
    if date_str.is_empty() {
        return None;
    }
    // RFC 3339 / ISO 8601
    if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(date_str) {
        return Some(dt.with_timezone(&chrono::Utc));
    }
    // RFC 2822 (standard RSS date format)
    if let Ok(dt) = chrono::DateTime::parse_from_rfc2822(date_str) {
        return Some(dt.with_timezone(&chrono::Utc));
    }
    // Fallback formats
    let formats = [
        "%a, %d %b %Y %H:%M:%S %z",
        "%Y-%m-%dT%H:%M:%S%:z",
        "%Y-%m-%d %H:%M:%S",
        "%d %b %Y %H:%M:%S %z",
    ];
    for fmt in &formats {
        if let Ok(dt) = chrono::NaiveDateTime::parse_from_str(date_str, fmt) {
            return Some(chrono::DateTime::from_naive_utc_and_offset(dt, chrono::Utc));
        }
    }
    None
}

fn url_to_domain(url: &str) -> String {
    url.split("//").nth(1).unwrap_or(url).split('/').next().unwrap_or(url).to_string()
}

async fn fetch_hn_security() -> Vec<NewsItem> {
    let client = reqwest::Client::new();
    let url = "https://hn.algolia.com/api/v1/search_by_date?tags=security&hitsPerPage=30";
    let res = client
        .get(url)
        .header("User-Agent", "StudyPlanner/1.0")
        .timeout(Duration::from_secs(15))
        .send()
        .await;
    let mut items = Vec::new();
    if let Ok(resp) = res {
        if let Ok(json) = resp.json::<serde_json::Value>().await {
            if let Some(hits) = json.get("hits").and_then(|v| v.as_array()) {
                for hit in hits {
                    let title = hit.get("title").and_then(|v| v.as_str()).unwrap_or("").to_string();
                    if title.is_empty() { continue; }
                    let object_id = hit.get("objectID").and_then(|v| v.as_str()).unwrap_or("").to_string();
                    let story_url = hit.get("url").and_then(|v| v.as_str())
                        .map(|s| s.to_string())
                        .unwrap_or_else(|| format!("https://news.ycombinator.com/item?id={}", object_id))
                        .to_string();
                    let created_at = hit.get("created_at").and_then(|v| v.as_str()).unwrap_or("").to_string();
                    let points = hit.get("points").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
                    let domain = url_to_domain(&story_url);
                    let published = parse_date(&created_at)
                        .map(|d| d.to_rfc3339())
                        .unwrap_or_else(|| chrono::Utc::now().to_rfc3339());
                    items.push(NewsItem {
                        id: format!("hn-{}", object_id),
                        title,
                        url: story_url,
                        source: "Hacker News".to_string(),
                        category: "General".to_string(),
                        domain,
                        published_at: published,
                        score: points,
                    });
                }
            }
        }
    }
    items
}

async fn fetch_rss_feed(feed: &FeedConfig) -> Vec<NewsItem> {
    let client = reqwest::Client::new();
    let res = client
        .get(feed.url)
        .header("User-Agent", "StudyPlanner/1.0")
        .timeout(Duration::from_secs(15))
        .send()
        .await;
    let mut items = Vec::new();
    if let Ok(resp) = res {
        if let Ok(bytes) = resp.bytes().await {
            // Try RSS 2.0 first
            if let Ok(channel) = rss::Channel::read_from(&bytes[..]) {
                let channel_date = channel.last_build_date()
                    .or(channel.pub_date())
                    .and_then(|d| parse_date(d));
                for item in channel.items().iter().take(20) {
                    let title = item.title().unwrap_or("").to_string();
                    if title.is_empty() { continue; }
                    let url = item.link().unwrap_or("").to_string();
                    let pub_date = item.pub_date()
                        .and_then(|d| parse_date(d))
                        .or(channel_date)
                        .map(|d| d.to_rfc3339())
                        .unwrap_or_else(|| chrono::Utc::now().to_rfc3339());
                    let domain = url_to_domain(&url);
                    items.push(NewsItem {
                        id: format!("rss-{}", format!("{:x}", md5::compute(format!("{}{}", feed.url, title)))),
                        title,
                        url,
                        source: feed.label.to_string(),
                        category: feed.category.to_string(),
                        domain,
                        published_at: pub_date,
                        score: 0,
                    });
                }
                return items;
            }
            // Try Atom as fallback
            let text = String::from_utf8_lossy(&bytes);
            if text.contains("<feed") {
                if let Ok(feed_doc) = atom_syndication::Feed::from_str(&text) {
                    for entry in feed_doc.entries().iter().take(20) {
                        let title = entry.title().to_string();
                        if title.is_empty() { continue; }
                        let url = entry.links().first().map(|l| l.href().to_string()).unwrap_or_default();
                        let pub_date = entry.published()
                            .and_then(|d| parse_date(&d.to_string()))
                            .or(parse_date(&entry.updated().to_string()))
                            .map(|d| d.to_rfc3339())
                            .unwrap_or_else(|| chrono::Utc::now().to_rfc3339());
                        let domain = url_to_domain(&url);
                        items.push(NewsItem {
                            id: format!("atom-{}", format!("{:x}", md5::compute(format!("{}{}", feed.url, title)))),
                            title,
                            url,
                            source: feed.label.to_string(),
                            category: feed.category.to_string(),
                            domain,
                            published_at: pub_date,
                            score: 0,
                        });
                    }
                }
            }
        }
    }
    items
}

#[tauri::command]
async fn fetch_news(handle: AppHandle) -> Result<Vec<NewsItem>, String> {
    // Reuse cache if fetched within the last 5 minutes
    let cache_path = news_path(&handle);
    if let Ok(meta) = std::fs::metadata(&cache_path) {
        if let Ok(modified) = meta.modified() {
            if let Ok(elapsed) = modified.elapsed() {
                if elapsed < Duration::from_secs(300) {
                    let raw = fs::read_to_string(&cache_path).map_err(|e| e.to_string())?;
                    let cached: NewsCache = serde_json::from_str(&raw).map_err(|e| e.to_string())?;
                    log::info!("Returning cached news ({} items)", cached.items.len());
                    return Ok(cached.items);
                }
            }
        }
    }

    let mut all = Vec::new();

    // Fetch Hacker News + all RSS feeds concurrently
    let mut tasks = vec![tokio::spawn(fetch_hn_security())];
    for feed in FEEDS.iter() {
        tasks.push(tokio::spawn(fetch_rss_feed(feed)));
    }

    let mut failed = 0usize;
    for task in tasks {
        match task.await {
            Ok(items) => all.extend(items),
            Err(_) => failed += 1,
        }
    }

    // Deduplicate by URL
    let mut seen = std::collections::HashSet::new();
    all.retain(|item| seen.insert(item.url.clone()));

    // Sort by parsed date desc (newest first)
    all.sort_by(|a, b| {
        let da = parse_date(&a.published_at).unwrap_or_else(|| chrono::DateTime::UNIX_EPOCH);
        let db = parse_date(&b.published_at).unwrap_or_else(|| chrono::DateTime::UNIX_EPOCH);
        db.cmp(&da)
    });

    // Limit to 100 items
    all.truncate(100);

    let cache = NewsCache {
        items: all.clone(),
        fetched_at: chrono::Utc::now().to_rfc3339(),
    };
    let _ = fs::write(news_path(&handle), serde_json::to_string_pretty(&cache).unwrap_or_default());

    log::info!("Fetched {} news items from {} sources ({} failed)", all.len(), FEEDS.len() + 1, failed);

    Ok(all)
}

#[tauri::command]
fn read_news_cache(handle: AppHandle) -> Result<String, String> {
    let path = news_path(&handle);
    if !path.exists() {
        return Ok(r#"{"items":[],"fetched_at":""}"#.to_string());
    }
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn read_timer_file(handle: AppHandle) -> Result<String, String> {
    let path = timer_path(&handle);
    if !path.exists() {
        return Ok(r#"{}"#.to_string());
    }
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_timer_file(handle: AppHandle, content: String) -> Result<(), String> {
    let path = timer_path(&handle);
    fs::write(&path, content).map_err(|e| e.to_string())
}

#[tauri::command]
fn read_window_state(handle: AppHandle) -> Result<String, String> {
    let path = window_state_path(&handle);
    if !path.exists() {
        return Ok(r#"{}"#.to_string());
    }
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_window_state(handle: AppHandle, content: String) -> Result<(), String> {
    let path = window_state_path(&handle);
    fs::write(&path, content).map_err(|e| e.to_string())
}

// ── Course Config Commands ──────────────────────────────────────────────────

#[tauri::command]
fn list_course_configs(handle: AppHandle) -> Result<Vec<serde_json::Value>, String> {
    let dir = courses_dir(&handle);
    let mut configs = Vec::new();
    if let Ok(entries) = fs::read_dir(&dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) == Some("json") {
                if let Ok(content) = fs::read_to_string(&path) {
                    if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                        configs.push(json);
                    }
                }
            }
        }
    }
    Ok(configs)
}

#[tauri::command]
fn read_course_config(handle: AppHandle, course_id: String) -> Result<String, String> {
    let path = course_path(&handle, &course_id);
    if !path.exists() {
        return Err(format!("Course config not found: {}", course_id));
    }
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_course_config(handle: AppHandle, course_id: String, content: String) -> Result<(), String> {
    let path = course_path(&handle, &course_id);
    fs::write(&path, content).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_course_config(handle: AppHandle, course_id: String) -> Result<(), String> {
    let path = course_path(&handle, &course_id);
    if path.exists() {
        fs::remove_file(&path).map_err(|e| e.to_string())?;
    }
    // Also delete logo if exists
    let logo_path = logos_dir(&handle).join(format!("{}.svg", course_id));
    if logo_path.exists() {
        let _ = fs::remove_file(&logo_path);
    }
    Ok(())
}

#[tauri::command]
fn import_course_config(handle: AppHandle, file_path: String) -> Result<String, String> {
    let content = fs::read_to_string(&file_path).map_err(|e| e.to_string())?;
    let json: serde_json::Value = serde_json::from_str(&content).map_err(|e| e.to_string())?;
    let course_id = json
        .get("id")
        .and_then(|v| v.as_str())
        .ok_or("Invalid config: missing 'id' field")?;
    let dest = course_path(&handle, course_id);
    fs::write(&dest, content).map_err(|e| e.to_string())?;
    Ok(course_id.to_string())
}

#[tauri::command]
fn export_course_config(handle: AppHandle, course_id: String, dest_path: String) -> Result<(), String> {
    let src = course_path(&handle, &course_id);
    if !src.exists() {
        return Err(format!("Course config not found: {}", course_id));
    }
    fs::copy(&src, &dest_path).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn save_logo_file(handle: AppHandle, course_id: String, content: String) -> Result<(), String> {
    let mut path = logos_dir(&handle);
    path.push(format!("{}.svg", course_id));
    fs::write(&path, content).map_err(|e| e.to_string())
}

#[tauri::command]
fn read_logo_file(handle: AppHandle, course_id: String) -> Result<String, String> {
    let mut path = logos_dir(&handle);
    path.push(format!("{}.svg", course_id));
    if !path.exists() {
        return Err("Logo not found".to_string());
    }
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn read_labs_file(handle: AppHandle) -> Result<String, String> {
    let path = labs_path(&handle);
    if !path.exists() {
        return Ok(r#"{"entries":{},"categories":{}}"#.to_string());
    }
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_labs_file(handle: AppHandle, content: String) -> Result<(), String> {
    let path = labs_path(&handle);
    fs::write(&path, content).map_err(|e| e.to_string())
}

#[tauri::command]
fn list_course_ids(handle: AppHandle) -> Result<Vec<String>, String> {
    let dir = courses_dir(&handle);
    let mut ids = Vec::new();
    if let Ok(entries) = fs::read_dir(&dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) == Some("json") {
                if let Some(stem) = path.file_stem().and_then(|s| s.to_str()) {
                    ids.push(stem.to_string());
                }
            }
        }
    }
    Ok(ids)
}

#[cfg(all(desktop))]
fn create_tray(handle: &AppHandle) -> Result<tauri::tray::TrayIcon, tauri::Error> {
    use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};

    let show_i = MenuItem::with_id(handle, "show", "Show", true, None::<&str>)?;
    let quit_i = MenuItem::with_id(handle, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(handle, &[&show_i, &PredefinedMenuItem::separator(handle)?, &quit_i])?;

    let tray = tauri::tray::TrayIconBuilder::new()
        .icon(handle.default_window_icon().unwrap().clone())
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.set_skip_taskbar(false);
                    let _ = window.show();
                    let _ = window.unminimize();
                    let _ = window.set_focus();
                }
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let tauri::tray::TrayIconEvent::Click { button: tauri::tray::MouseButton::Left, .. } = event {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.set_skip_taskbar(false);
                    let _ = window.show();
                    let _ = window.unminimize();
                    let _ = window.set_focus();
                }
            }
        })
        .build(handle)?;

    Ok(tray)
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            read_timer_file,
            write_timer_file,
            read_window_state,
            write_window_state,
            read_labs_file,
            write_labs_file,
            list_course_configs,
            read_course_config,
            write_course_config,
            delete_course_config,
            import_course_config,
            export_course_config,
            save_logo_file,
            read_logo_file,
            list_course_ids,
            fetch_news,
            read_news_cache,
        ])
        .setup(|app| {
            #[cfg(all(desktop))]
            {
                let handle = app.handle();
                let _tray = create_tray(handle).expect("failed to create tray");

                // Restore window state or auto-size to display on first launch
                if let Some(window) = app.get_webview_window("main") {
                    let state_path = window_state_path(handle);
                    let has_saved_state = state_path.exists() && fs::read_to_string(&state_path).map(|c| !c.is_empty()).unwrap_or(false);

                    if has_saved_state {
                        if let Ok(content) = fs::read_to_string(&state_path) {
                            if let Ok(state) = serde_json::from_str::<serde_json::Value>(&content) {
                                if let (Some(x), Some(y)) = (
                                    state.get("x").and_then(|v| v.as_f64()),
                                    state.get("y").and_then(|v| v.as_f64()),
                                ) {
                                    let _ = window.set_position(tauri::Position::Physical(tauri::PhysicalPosition { x: x as i32, y: y as i32 }));
                                }
                                if let (Some(w), Some(h)) = (
                                    state.get("width").and_then(|v| v.as_f64()),
                                    state.get("height").and_then(|v| v.as_f64()),
                                ) {
                                    let _ = window.set_size(tauri::Size::Physical(tauri::PhysicalSize { width: w as u32, height: h as u32 }));
                                }
                                if let Some(maximized) = state.get("maximized").and_then(|v| v.as_bool()) {
                                    if maximized {
                                        let _ = window.maximize();
                                    }
                                }
                                if let Some(fullscreen) = state.get("fullscreen").and_then(|v| v.as_bool()) {
                                    if fullscreen {
                                        let _ = window.set_fullscreen(true);
                                    }
                                }
                            }
                        }
                    } else {
                        // First launch: size to 85% of primary monitor, centered
                        if let Ok(Some(monitor)) = app.primary_monitor() {
                            let size = monitor.size();
                            let new_w = ((size.width as f32) * 0.85).clamp(900.0, 1600.0) as u32;
                            let new_h = ((size.height as f32) * 0.85).clamp(600.0, 1000.0) as u32;
                            let _ = window.set_size(tauri::Size::Physical(tauri::PhysicalSize { width: new_w, height: new_h }));
                            let _ = window.center();
                        }
                    }
                }
            }
            Ok(())
        })
        .on_window_event(|window, event| match event {
            WindowEvent::CloseRequested { .. } => {
                persist_window_state(window, true);
            }
            WindowEvent::Resized(_) => {
                if let Ok(true) = window.is_minimized() {
                    let _ = window.hide();
                    let _ = window.set_skip_taskbar(true);
                }
                persist_window_state(window, false);
            }
            WindowEvent::Moved(_) => {
                persist_window_state(window, false);
            }
            _ => {}
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
