import { invoke } from "@tauri-apps/api/core"
import { IS_TAURI } from "./is-tauri"

const WEB_NEWS_KEY = "web:news_cache"

export interface NewsItem {
  id: string
  title: string
  url: string
  source: string
  category?: string
  domain: string
  published_at: string
  score: number
}

export interface NewsCache {
  items: NewsItem[]
  fetched_at: string
}

const FEED_CONFIGS = [
  { url: "https://www.bleepingcomputer.com/feed/", label: "BleepingComputer", category: "General" },
  { url: "https://feeds.feedburner.com/TheHackersNews", label: "The Hacker News", category: "General" },
  { url: "https://isc.sans.edu/rssfeed_full.xml", label: "SANS ISC", category: "DFIR" },
  { url: "https://0dayfans.com/feed", label: "0dayfans", category: "Vulnerabilities" },
  { url: "https://cyberalerts.io/rss/", label: "Cyber Alerts", category: "General" },
  { url: "https://grahamcluley.com/feed/", label: "Graham Cluley", category: "General" },
  { url: "https://krebsonsecurity.com/feed/", label: "Krebs on Security", category: "Investigative" },
  { url: "https://news.sophos.com/en-us/category/security-operations/feed/", label: "Sophos SecOps", category: "Blue Team" },
  { url: "https://news.sophos.com/en-us/category/threat-research/feed/", label: "Sophos Threat Research", category: "Threat Intel" },
  { url: "https://securelist.com/feed/", label: "Securelist", category: "Malware" },
  { url: "https://www.schneier.com/feed/", label: "Schneier on Security", category: "Policy" },
  { url: "https://www.troyhunt.com/rss/", label: "Troy Hunt", category: "Blue Team" },
  { url: "https://www.usom.gov.tr/rss/duyuru.rss", label: "USOM Notices", category: "Government" },
  { url: "https://www.usom.gov.tr/rss/tehdit.rss", label: "USOM Threats", category: "Government" },
]

const PROXY_URLS = [
  (url: string) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
  (url: string) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
]

function urlToDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url.split("//")[1]?.split("/")[0] || url
  }
}

function parseRss(xml: string): { title: string; link: string; isoDate: string }[] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xml, "application/xml")

  const parseError = doc.querySelector("parsererror")
  if (parseError) throw new Error("Invalid XML")

  const items: { title: string; link: string; isoDate: string }[] = []

  // RSS 2.0
  doc.querySelectorAll("item").forEach((item) => {
    const title = item.querySelector("title")?.textContent?.trim() || ""
    let link = item.querySelector("link")?.textContent?.trim() || ""
    if (!link) {
      const guid = item.querySelector("guid")
      if (guid?.getAttribute("isPermaLink") === "true") {
        link = guid.textContent?.trim() || ""
      }
    }
    const pubDate = item.querySelector("pubDate")?.textContent?.trim() || ""
    if (title && link) {
      const date = new Date(pubDate)
      items.push({
        title,
        link,
        isoDate: isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString(),
      })
    }
  })

  if (items.length > 0) return items

  // Atom
  doc.querySelectorAll("entry").forEach((entry) => {
    const title = entry.querySelector("title")?.textContent?.trim() || ""
    const linkEl = entry.querySelector("link")
    const link = linkEl?.getAttribute("href") || linkEl?.textContent?.trim() || ""
    const published =
      entry.querySelector("published")?.textContent?.trim() ||
      entry.querySelector("updated")?.textContent?.trim() ||
      ""
    if (title && link) {
      const date = new Date(published)
      items.push({
        title,
        link,
        isoDate: isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString(),
      })
    }
  })

  return items
}

async function fetchViaProxy(proxyUrl: string): Promise<string> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)
  const res = await fetch(proxyUrl, {
    signal: controller.signal,
    headers: {
      "User-Agent": "Study-Planner-App/1.0",
    },
  })
  clearTimeout(timeout)
  if (!res.ok) throw new Error(`Proxy HTTP ${res.status}`)

  const contentType = res.headers.get("content-type") || ""
  if (contentType.includes("application/json")) {
    const json = await res.json()
    if (typeof json.contents === "string") return json.contents
    if (typeof json.data === "string") return json.data
    throw new Error("Unexpected JSON response from proxy")
  }

  return res.text()
}

async function fetchFeedViaProxy(
  feedUrl: string
): Promise<{ title: string; link: string; isoDate: string }[]> {
  let lastErr: Error | null = null
  for (const makeProxy of PROXY_URLS) {
    try {
      const proxyUrl = makeProxy(feedUrl)
      const xml = await fetchViaProxy(proxyUrl)
      const items = parseRss(xml)
      if (items.length > 0) return items.slice(0, 20)
      // Parsing succeeded but no items — keep trying other proxies
      lastErr = new Error("Parsed 0 items")
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err))
      console.warn(`Proxy failed for ${feedUrl}:`, lastErr.message)
    }
  }
  throw lastErr || new Error("All proxies failed")
}

export async function readNewsCache(): Promise<NewsCache> {
  try {
    const data = IS_TAURI
      ? await invoke<string>("read_news_cache")
      : localStorage.getItem(WEB_NEWS_KEY) ?? ""
    if (!data) return { items: [], fetched_at: "" }
    const parsed = JSON.parse(data)
    if (!parsed || typeof parsed !== "object") return { items: [], fetched_at: "" }
    return {
      items: Array.isArray(parsed.items) ? parsed.items : [],
      fetched_at: typeof parsed.fetched_at === "string" ? parsed.fetched_at : "",
    }
  } catch {
    return { items: [], fetched_at: "" }
  }
}

export async function fetchNews(): Promise<NewsItem[]> {
  if (IS_TAURI) {
    return await invoke<NewsItem[]>("fetch_news")
  }

  // Browser dev mode: fetch via CORS proxies
  const all: NewsItem[] = []
  const errors: string[] = []

  await Promise.all(
    FEED_CONFIGS.map(async (feed) => {
      try {
        const items = await fetchFeedViaProxy(feed.url)
        for (const item of items) {
          if (!item.title || !item.link) continue
          all.push({
            id: `rss-${feed.label}-${item.title.slice(0, 40)}`,
            title: item.title,
            url: item.link,
            source: feed.label,
            category: feed.category,
            domain: urlToDomain(item.link),
            published_at: item.isoDate,
            score: 0,
          })
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errors.push(`${feed.label}: ${msg}`)
      }
    })
  )

  if (errors.length > 0) {
    console.warn("Failed feeds:", errors)
  }

  // Deduplicate by URL
  const seen = new Set<string>()
  const deduped = all.filter((item) => {
    if (seen.has(item.url)) return false
    seen.add(item.url)
    return true
  })

  // Sort by date desc
  deduped.sort((a, b) => {
    const da = new Date(a.published_at).getTime() || 0
    const db = new Date(b.published_at).getTime() || 0
    return db - da
  })

  const result = deduped.slice(0, 100)

  // Cache to localStorage
  const cache: NewsCache = {
    items: result,
    fetched_at: new Date().toISOString(),
  }
  try {
    localStorage.setItem(WEB_NEWS_KEY, JSON.stringify(cache))
  } catch { /* quota error */ }

  return result
}

export function timeAgo(dateStr: string): string {
  if (!dateStr) return ""
  const then = new Date(dateStr)
  if (isNaN(then.getTime())) return dateStr
  const now = new Date()
  const diff = Math.floor((now.getTime() - then.getTime()) / 1000)
  if (diff < 60) return "just now"
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return then.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

export const CATEGORY_COLORS: Record<string, string> = {
  General: "#6B7280",
  "Blue Team": "#0891B2",
  "Threat Intel": "#7C3AED",
  DFIR: "#2E7D32",
  Malware: "#DC2626",
  Government: "#B45309",
  Investigative: "#BE185D",
  Vulnerabilities: "#EA580C",
  Policy: "#4F46E5",
}

export const SOURCE_COLORS: Record<string, string> = {
  "Hacker News": "#FF6600",
  BleepingComputer: "#0D47A1",
  "The Hacker News": "#1A1A1A",
  "SANS ISC": "#2E7D32",
  "0dayfans": "#EA580C",
  "Cyber Alerts": "#6B7280",
  "Graham Cluley": "#4F46E5",
  "Krebs on Security": "#BE185D",
  "Sophos SecOps": "#0891B2",
  "Sophos Threat Research": "#7C3AED",
  Securelist: "#DC2626",
  "Schneier on Security": "#4F46E5",
  "Troy Hunt": "#0891B2",
  "USOM Notices": "#B45309",
  "USOM Threats": "#B45309",
}
