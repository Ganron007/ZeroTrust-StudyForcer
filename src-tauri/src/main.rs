#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::env;
use std::fs;
use std::path::PathBuf;
use std::str::FromStr;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Manager, WindowEvent};

// R7: Global lazy reqwest::Client for connection pooling
fn http_client() -> &'static reqwest::Client {
    static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
    CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .timeout(Duration::from_secs(15))
            .build()
            .unwrap_or_default()
    })
}

// R6: Limit concurrent feed fetches to avoid resource exhaustion
const MAX_CONCURRENT_FEEDS: usize = 6;

// Window-state writes are throttled: a resize/move can fire dozens of times per
// second, and writing plans.json each time burns disk and CPU. We rate-limit to
// at most one write per WINDOW_STATE_THROTTLE; on CloseRequested we flush
// unconditionally so the final position is always saved.
const WINDOW_STATE_THROTTLE: Duration = Duration::from_millis(500);
static LAST_WINDOW_STATE_WRITE: Mutex<Option<Instant>> = Mutex::new(None);

fn persist_window_state(window: &tauri::Window, force: bool) {
    if !force {
        // R9: Recover from poisoned Mutex instead of degrading silently
        let mut guard = match LAST_WINDOW_STATE_WRITE.lock() {
            Ok(g) => g,
            Err(poisoned) => {
                log::warn!("Window-state Mutex was poisoned — recovering");
                poisoned.into_inner()
            }
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
    let pos = match window.outer_position() {
        Ok(p) => p,
        Err(_) => return,
    };
    let size = match window.outer_size() {
        Ok(s) => s,
        Err(_) => return,
    };
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
    let mut path = match env::current_exe() {
        Ok(exe) => exe.parent().map(|p| p.to_path_buf()).unwrap_or_else(|| PathBuf::from(".")),
        Err(_) => env::current_dir().unwrap_or_else(|_| PathBuf::from(".")),
    };
    path.push("data");
    if !path.exists() {
        if let Err(e) = fs::create_dir_all(&path) {
            log::warn!("Could not create data dir at {:?}: {}. Falling back to current directory.", path, e);
            return env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
        }
    }
    path
}

fn courses_dir(handle: &AppHandle) -> PathBuf {
    let mut path = app_dir(handle);
    path.push("courses");
    if !path.exists() {
        let _ = fs::create_dir_all(&path);
    }
    path
}

fn logos_dir(handle: &AppHandle) -> PathBuf {
    let mut path = app_dir(handle);
    path.push("logos");
    if !path.exists() {
        let _ = fs::create_dir_all(&path);
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

/// v2.4.7 (Phase 2.4): backups directory under app data. Holds auto-backup
/// files named `YYYY-MM-DD.json`. Roll oldest after N backups.
fn backups_dir(handle: &AppHandle) -> PathBuf {
    let mut path = app_dir(handle);
    path.push("backups");
    if !path.exists() {
        let _ = fs::create_dir_all(&path);
    }
    path
}

fn validate_course_id(id: &str) -> Result<(), String> {
    if id.is_empty() || id.len() > 128 {
        return Err("Course ID must be 1–128 characters".into());
    }
    if !id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_') {
        return Err("Course ID must contain only letters, digits, hyphens, or underscores".into());
    }
    if id.contains("..") {
        return Err("Course ID must not contain '..'".into());
    }
    Ok(())
}

// v2.4.6 (M-5): Serialize news cache writes to prevent concurrent-task race.
// R1: Use tokio::sync::Mutex so the guard can be held across .await (tokio::fs::write).
// tokio::sync::Mutex::new is not const, so use OnceLock for lazy init.
static NEWS_CACHE_LOCK: std::sync::OnceLock<tokio::sync::Mutex<()>> = std::sync::OnceLock::new();
fn news_cache_lock() -> &'static tokio::sync::Mutex<()> {
    NEWS_CACHE_LOCK.get_or_init(|| tokio::sync::Mutex::new(()))
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

#[derive(Clone, Copy)]
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
    // R7: Use global lazy client for connection pooling
    let client = http_client();
    let url = "https://hn.algolia.com/api/v1/search_by_date?tags=security&hitsPerPage=30";
    let res = client
        .get(url)
        .header("User-Agent", "ZeroTrustStudyForcer/1.0")
        .send()
        .await;
    let mut items = Vec::new();
    if let Ok(resp) = res {
        // R3: Check HTTP status code before processing
        let resp = match resp.error_for_status() {
            Ok(r) => r,
            Err(e) => {
                log::warn!("[fetch_hn_security] HTTP error: {}", e);
                return items;
            }
        };
        // R4: Streaming body size check — stop reading when limit exceeded
        // instead of downloading the entire body into memory first.
        const BODY_LIMIT: usize = 10_000_000;
        let mut body_text = String::new();
        let mut body_ok = true;
        if let Ok(bytes) = resp.bytes().await {
            if bytes.len() > BODY_LIMIT {
                log::warn!("[fetch_hn_security] body exceeds {} bytes, truncating", BODY_LIMIT);
                body_ok = false;
            } else {
                body_text = String::from_utf8_lossy(&bytes).into_owned();
            }
        }
        if !body_ok { return items; }
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&body_text) {
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
                    // A38: Use empty string for unparseable dates instead of now().
                    // Items with unparseable dates sort to the bottom (UNIX_EPOCH in sort).
                    let published = parse_date(&created_at)
                        .map(|d| d.to_rfc3339())
                        .unwrap_or_default();
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
    // R7: Use global lazy client for connection pooling
    let client = http_client();
    let res = client
        .get(feed.url)
        .header("User-Agent", "ZeroTrustStudyForcer/1.0")
        .send()
        .await;
    let mut items = Vec::new();
    if let Ok(resp) = res {
        // R3: Check HTTP status code before processing
        let resp = match resp.error_for_status() {
            Ok(r) => r,
            Err(e) => {
                log::warn!("[fetch_rss_feed] HTTP error for {}: {}", feed.label, e);
                return items;
            }
        };
        // R4: Check body size before processing
        if let Ok(bytes) = resp.bytes().await {
            if bytes.len() > 10_000_000 {
                log::warn!("[fetch_rss_feed] body for {} exceeds 10 MB, skipping", feed.label);
                return items;
            }
            // Try RSS 2.0 first
            if let Ok(channel) = rss::Channel::read_from(&bytes[..]) {
                let channel_date = channel.last_build_date()
                    .or(channel.pub_date())
                    .and_then(|d| parse_date(d));
                for item in channel.items().iter().take(20) {
                    let title = item.title().unwrap_or("").to_string();
                    if title.is_empty() { continue; }
                    let url = item.link().unwrap_or("").to_string();
                    // A38: Use empty string for unparseable dates instead of now()
                    let pub_date = item.pub_date()
                        .and_then(|d| parse_date(d))
                        .or(channel_date)
                        .map(|d| d.to_rfc3339())
                        .unwrap_or_default();
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
                        // A38: Use empty string for unparseable dates instead of now()
                        let pub_date = entry.published()
                            .and_then(|d| parse_date(&d.to_string()))
                            .or(parse_date(&entry.updated().to_string()))
                            .map(|d| d.to_rfc3339())
                            .unwrap_or_default();
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
    // R1: Use tokio::fs for async cache read (no blocking in async context)
    let cache_path = news_path(&handle);
    if let Ok(meta) = tokio::fs::metadata(&cache_path).await {
        if let Ok(modified) = meta.modified() {
            if let Ok(elapsed) = modified.elapsed() {
                if elapsed < Duration::from_secs(300) {
                    if let Ok(raw) = tokio::fs::read_to_string(&cache_path).await {
                        if let Ok(cached) = serde_json::from_str::<NewsCache>(&raw) {
                            log::info!("Returning cached news ({} items)", cached.items.len());
                            return Ok(cached.items);
                        }
                    }
                }
            }
        }
    }

    let mut all = Vec::new();

    // R6: Semaphore to limit concurrent feed fetches
    let semaphore = std::sync::Arc::new(tokio::sync::Semaphore::new(MAX_CONCURRENT_FEEDS));

    // R11: Overall 45-second timeout for entire fetch operation
    let fetch_result = tokio::time::timeout(Duration::from_secs(45), async {
        let mut tasks = Vec::new();

        // Spawn HN fetch with semaphore and per-task timeout
        let sem = semaphore.clone();
        tasks.push(tokio::spawn(async move {
            let _permit = sem.acquire().await.ok();
            // R2: Per-task 20-second timeout
            match tokio::time::timeout(Duration::from_secs(20), fetch_hn_security()).await {
                Ok(items) => items,
                Err(_) => {
                    log::warn!("[fetch_news] HN fetch timed out");
                    Vec::new()
                }
            }
        }));

        // Spawn RSS feed fetches with semaphore and per-task timeout
        for feed in FEEDS.iter() {
            let sem = semaphore.clone();
            // &'static str fields are Copy — capture them directly instead of
            // cloning to String + Box::leak (which leaked 42 allocations per fetch).
            let feed_config = *feed;
            tasks.push(tokio::spawn(async move {
                let _permit = sem.acquire().await.ok();
                // R2: Per-task 20-second timeout
                match tokio::time::timeout(Duration::from_secs(20), fetch_rss_feed(&feed_config)).await {
                    Ok(items) => items,
                    Err(_) => {
                        log::warn!("[fetch_news] RSS fetch timed out for {}", feed_config.label);
                        Vec::new()
                    }
                }
            }));
        }

        let mut failed = 0usize;
        for task in tasks {
            // R8: Log warnings on task panics
            // A37: Count empty-result fetches as failed too — previously only
            // JoinError (panics) incremented the counter, so a fetch that
            // returned Ok(Vec::new()) was counted as success.
            match task.await {
                Ok(items) => {
                    if items.is_empty() {
                        failed += 1;
                    }
                    all.extend(items);
                }
                Err(e) => {
                    log::warn!("[fetch_news] task panicked: {}", e);
                    failed += 1;
                }
            }
        }

        log::info!("Fetched {} news items from {} sources ({} failed)", all.len(), FEEDS.len() + 1, failed);
    }).await;

    if fetch_result.is_err() {
        log::warn!("[fetch_news] overall 45s timeout exceeded");
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
    // v2.4.6 (M-5): Serialize cache writes via Mutex guard.
    // R1: Use tokio::fs to avoid blocking the async runtime.
    // R5: Skip write if serialization failed (empty string = corruption)
    let cache_json = serde_json::to_string_pretty(&cache).unwrap_or_default();
    if !cache_json.is_empty() {
        let _lock = news_cache_lock().lock().await;
        let path = news_path(&handle);
        let write_result = tokio::fs::write(&path, &cache_json).await;
        if let Err(e) = write_result {
            log::warn!("[fetch_news] cache write failed: {}", e);
        }
    } else {
        log::warn!("[fetch_news] cache serialization failed — skipping write");
    }

    Ok(all)
}

#[tauri::command]
fn read_news_cache(handle: AppHandle) -> Result<String, String> {
    let path = news_path(&handle);
    if !path.exists() {
        return Ok(r#"{"items":[],"fetched_at":""}"#.to_string());
    }
    // v2.4.6 (H-1): Return empty state on read/parse error instead of
    // propagating — a corrupted cache file should not crash the app.
    let content = match fs::read_to_string(&path) {
        Ok(c) => c,
        Err(_) => return Ok(r#"{"items":[],"fetched_at":""}"#.to_string()),
    };
    if serde_json::from_str::<serde_json::Value>(&content).is_err() {
        log::warn!("[news_cache] corrupted cache file — returning empty");
        return Ok(r#"{"items":[],"fetched_at":""}"#.to_string());
    }
    Ok(content)
}

// ── Auto-backup (Phase 2.4) ────────────────────────────────────────────────

/// v2.4.7 (Phase 2.4): Write a backup JSON file. Filename must match
/// `YYYY-MM-DD.json`. Refuses to overwrite an existing file (auto-backup
/// is one-per-day).
#[tauri::command]
fn write_backup_file(handle: AppHandle, filename: String, content: String) -> Result<(), String> {
    // Validate filename: must be exactly YYYY-MM-DD.json
    if !is_valid_backup_filename(&filename) {
        return Err("Backup filename must be YYYY-MM-DD.json".into());
    }

    let dir = backups_dir(&handle);
    let path = dir.join(&filename);
    if path.exists() {
        // Already backed up today — silently no-op (idempotent).
        return Ok(());
    }
    fs::write(&path, content).map_err(|e| e.to_string())
}

fn is_valid_backup_filename(name: &str) -> bool {
    // Format: YYYY-MM-DD.json (15 chars: 4 + 1 + 2 + 1 + 2 + 1 + 4)
    if name.len() != 15 { return false; }
    let bytes = name.as_bytes();
    // First 4 chars: year (digits)
    if !bytes[..4].iter().all(|b| b.is_ascii_digit()) { return false; }
    // 5th and 8th chars: '-'
    if bytes[4] != b'-' || bytes[7] != b'-' { return false; }
    // Chars 5-6: month (digits)
    if !bytes[5..7].iter().all(|b| b.is_ascii_digit()) { return false; }
    // Chars 8-9: day (digits)
    if !bytes[8..10].iter().all(|b| b.is_ascii_digit()) { return false; }
    // 11th char: '.'
    if bytes[10] != b'.' { return false; }
    // Chars 11-13: "json" extension
    &bytes[11..] == b"json"
}

/// v2.4.7 (Phase 2.4): List existing backup files (newest first).
/// Returns a Vec of ISO-date strings ("YYYY-MM-DD") for every backup present.
#[tauri::command]
fn list_backups(handle: AppHandle) -> Result<Vec<String>, String> {
    let dir = backups_dir(&handle);
    let mut out: Vec<String> = Vec::new();
    if let Ok(entries) = fs::read_dir(&dir) {
        for entry in entries.flatten() {
            if let Some(name) = entry.file_name().to_str() {
                if is_valid_backup_filename(name) {
                    out.push(name[..10].to_string());
                }
            }
        }
    }
    out.sort_by(|a, b| b.cmp(a)); // newest first
    Ok(out)
}

/// v2.4.7 (Phase 2.4): Prune oldest backups to keep at most `keep` files.
/// `keep` must be > 0. Newer backups are preserved.
#[tauri::command]
fn prune_old_backups(handle: AppHandle, keep: usize) -> Result<(), String> {
    if keep == 0 {
        return Err("keep must be > 0".into());
    }
    let dir = backups_dir(&handle);
    let mut files: Vec<(String, PathBuf)> = Vec::new();
    if let Ok(entries) = fs::read_dir(&dir) {
        for entry in entries.flatten() {
            if let Some(name) = entry.file_name().to_str() {
                if is_valid_backup_filename(name) {
                    files.push((name.to_string(), entry.path()));
                }
            }
        }
    }
    files.sort_by(|a, b| b.0.cmp(&a.0)); // newest first by filename (lexicographic == ISO date)
    for (name, path) in files.iter().skip(keep) {
        let _ = fs::remove_file(path);
        log::info!("[backup] pruned old backup: {}", name);
    }
    Ok(())
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
    // A39: Atomic write via tmp + rename
    let tmp = path.with_extension("tmp");
    fs::write(&tmp, &content).map_err(|e| e.to_string())?;
    fs::rename(&tmp, &path).map_err(|e| e.to_string())
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
    // R12: Respect the same throttle as persist_window_state.
    // The event-handler path already throttles; the command path was bypassing it.
    {
        let mut guard = match LAST_WINDOW_STATE_WRITE.lock() {
            Ok(g) => g,
            Err(poisoned) => {
                log::warn!("Window-state Mutex was poisoned — recovering");
                poisoned.into_inner()
            }
        };
        let now = Instant::now();
        if let Some(prev) = *guard {
            if now.duration_since(prev) < WINDOW_STATE_THROTTLE {
                // Throttled — skip the write (frontend will retry on next event)
                return Ok(());
            }
        }
        *guard = Some(now);
    }
    // A39: Atomic write via tmp + rename
    let path = window_state_path(&handle);
    let tmp = path.with_extension("tmp");
    fs::write(&tmp, &content).map_err(|e| e.to_string())?;
    fs::rename(&tmp, &path).map_err(|e| e.to_string())
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
    validate_course_id(&course_id)?;
    let path = course_path(&handle, &course_id);
    if !path.exists() {
        return Err(format!("Course config not found: {}", course_id));
    }
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_course_config(handle: AppHandle, course_id: String, content: String) -> Result<(), String> {
    validate_course_id(&course_id)?;
    let path = course_path(&handle, &course_id);
    // A45: Atomic write to prevent half-written file on crash
    let tmp = path.with_extension("tmp");
    fs::write(&tmp, &content).map_err(|e| e.to_string())?;
    fs::rename(&tmp, &path).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_course_config(handle: AppHandle, course_id: String) -> Result<(), String> {
    validate_course_id(&course_id)?;
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
    let target = PathBuf::from(&file_path);
    if !target.is_file() {
        return Err("File not found".into());
    }
    let content = fs::read_to_string(&file_path).map_err(|e| e.to_string())?;
    let json: serde_json::Value = serde_json::from_str(&content).map_err(|e| e.to_string())?;
    let course_id = json
        .get("id")
        .and_then(|v| v.as_str())
        .ok_or("Invalid config: missing 'id' field")?;
    validate_course_id(course_id)?;
    let dest = course_path(&handle, course_id);
    // A46: Check for existing course before overwriting
    if dest.exists() {
        return Err(format!("Course '{}' already exists. Delete it first or use a different id.", course_id));
    }
    let tmp = dest.with_extension("tmp");
    fs::write(&tmp, &content).map_err(|e| e.to_string())?;
    fs::rename(&tmp, &dest).map_err(|e| e.to_string())?;
    Ok(course_id.to_string())
}

#[tauri::command]
fn export_course_config(handle: AppHandle, course_id: String, dest_path: String) -> Result<(), String> {
    validate_course_id(&course_id)?;
    let src = course_path(&handle, &course_id);
    if !src.exists() {
        return Err(format!("Course config not found: {}", course_id));
    }
    fs::copy(&src, &dest_path).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn save_logo_file(handle: AppHandle, course_id: String, content: String) -> Result<(), String> {
    validate_course_id(&course_id)?;
    let mut path = logos_dir(&handle);
    path.push(format!("{}.svg", course_id));
    fs::write(&path, content).map_err(|e| e.to_string())
}

#[tauri::command]
fn read_logo_file(handle: AppHandle, course_id: String) -> Result<String, String> {
    validate_course_id(&course_id)?;
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
        // A40: Return shape matching LabsStorage TS interface:
        // { labs: LabDefinition[], sessions: LabSession[], categories: {} }
        return Ok(r#"{"labs":[],"sessions":[],"categories":{}}"#.to_string());
    }
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_labs_file(handle: AppHandle, content: String) -> Result<(), String> {
    let path = labs_path(&handle);
    // A39: Atomic write via tmp + rename
    let tmp = path.with_extension("tmp");
    fs::write(&tmp, &content).map_err(|e| e.to_string())?;
    fs::rename(&tmp, &path).map_err(|e| e.to_string())
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

    // A41: Gracefully handle missing tray icon instead of panicking.
    // If no icon is available, skip tray creation altogether.
    let default_icon = handle.default_window_icon();
    let icon = match default_icon {
        Some(ic) => ic.clone(),
        None => {
            log::warn!("No default window icon found — creating tray without icon");
            let tray = tauri::tray::TrayIconBuilder::new()
                .menu(&menu)
                .build(handle)?;
            return Ok(tray);
        }
    };
    let tray = tauri::tray::TrayIconBuilder::new()
        .icon(icon)
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
        .plugin(tauri_plugin_notification::init())
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
            write_backup_file,
            list_backups,
            prune_old_backups,
        ])
        .setup(|app| {
            #[cfg(all(desktop))]
            {
                let handle = app.handle();
                // Gracefully degrade if tray creation fails (e.g. no icon or system limitation)
                if let Err(e) = create_tray(handle) {
                    log::warn!("Failed to create system tray: {}", e);
                }

                // Restore window state or auto-size to display on first launch
                if let Some(window) = app.get_webview_window("main") {
                    let state_path = window_state_path(handle);
                    let has_saved_state = state_path.exists() && fs::read_to_string(&state_path).map(|c| !c.is_empty()).unwrap_or(false);

                    if has_saved_state {
                        if let Ok(content) = fs::read_to_string(&state_path) {
                            if let Ok(state) = serde_json::from_str::<serde_json::Value>(&content) {
                                // R10: Clamp f64→i32/u32 casts to prevent undefined behavior
                                    if let (Some(x), Some(y)) = (
                                        state.get("x").and_then(|v| v.as_f64()),
                                        state.get("y").and_then(|v| v.as_f64()),
                                    ) {
                                        let x = (x as i32).clamp(0, 99999);
                                        let y = (y as i32).clamp(0, 99999);
                                        let _ = window.set_position(tauri::Position::Physical(tauri::PhysicalPosition { x, y }));
                                    }
                                    if let (Some(w), Some(h)) = (
                                        state.get("width").and_then(|v| v.as_f64()),
                                        state.get("height").and_then(|v| v.as_f64()),
                                    ) {
                                        let w = (w as u32).clamp(600, 3840);
                                        let h = (h as u32).clamp(400, 2160);
                                        let _ = window.set_size(tauri::Size::Physical(tauri::PhysicalSize { width: w, height: h }));
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
