"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { readNewsCache, fetchNews, timeAgo, CATEGORY_COLORS } from "@/lib/news-storage"
import type { NewsItem } from "@/lib/news-storage"
import { IS_TAURI } from "@/lib/is-tauri"
import { open } from "@tauri-apps/plugin-shell"
import { Newspaper, RefreshCw, ExternalLink, Filter, ChevronLeft, Globe } from "lucide-react"
import { showToast } from "./NotificationToast"
import { usePersonality } from "./PersonalityProvider"
import { formatStr } from "@/lib/personality"

// v2.4.6 (M-29): Only allow https:// URLs through shell.open to prevent
// file:// or javascript: injection from RSS feeds.
function safeOpen(url: string) {
  const trimmed = url.trim()
  if (!/^https:\/\/[^\s/$.?#].[^\s]*$/i.test(trimmed)) {
    console.warn("[SecurityNewsFeed] blocked non-https URL:", trimmed)
    return
  }
  open(trimmed)
}

type CategoryFilter = "all" | string

const DEFAULT_CATEGORIES = [
  "General",
  "Blue Team",
  "Threat Intel",
  "DFIR",
  "Malware",
  "Government",
  "Investigative",
  "Vulnerabilities",
  "Policy",
]

interface Props {
  onClose?: () => void
}

export default function SecurityNewsFeed({ onClose }: Props) {
  const { label, toast: tToast } = usePersonality()
  const [items, setItems] = useState<NewsItem[]>([])
  const [fetchedAt, setFetchedAt] = useState("")
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<CategoryFilter>("all")

  const load = useCallback(async () => {
    const cache = await readNewsCache()
    setItems(cache.items)
    setFetchedAt(cache.fetched_at)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot data load on mount
    load()
  }, [load])

  async function handleRefresh() {
    setLoading(true)
    try {
      const fresh = await fetchNews()
      setItems(fresh)
      setFetchedAt(new Date().toISOString())
      showToast(formatStr(tToast("newsLoaded"), { count: fresh.length }), "info")
    // A43: Don't reload cache on error — the existing cache is fine
    } catch (e) {
      console.error("[SecurityNewsFeed] Refresh failed:", e)
      showToast(tToast("newsFailed"), "info")
    } finally {
      setLoading(false)
    }
  }

  const categories = useMemo(() => {
    const set = new Set<string>()
    for (const item of items) {
      const cat = item.category || "General"
      set.add(cat)
    }
    // Preserve default order for known categories, then append unknowns
    const ordered: string[] = []
    for (const c of DEFAULT_CATEGORIES) {
      if (set.has(c)) ordered.push(c)
    }
    for (const c of set) {
      if (!ordered.includes(c)) ordered.push(c)
    }
    return ordered
  }, [items])

  const sources = useMemo(() => {
    const set = new Set<string>()
    for (const item of items) set.add(item.source)
    return Array.from(set).sort()
  }, [items])

  const filtered = useMemo(() => {
    if (filter === "all") return items
    return items.filter((i) => (i.category || "General") === filter)
  }, [items, filter])

  const hnItems = useMemo(() => items.filter((i) => i.source === "Hacker News"), [items])

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-border bg-card/90 backdrop-blur-sm shadow-sm p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            {onClose && (
              <button
                onClick={onClose}
                className="flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors mb-2"
              >
                <ChevronLeft className="w-4 h-4" />
                {label("backToView")}
              </button>
            )}
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-2">{label("securityBriefing")}</p>
            <h2 className="text-2xl font-bold text-foreground mb-1">{label("cybersecurityNews")}</h2>
            <p className="text-sm text-muted-foreground">
              {label("aggregatedFrom")} {sources.length} {label("securityBlogsAndFeeds")}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {fetchedAt && (
              <span className="text-xs text-muted-foreground hidden sm:inline">
                {formatStr(label("lastUpdated"), { time: timeAgo(fetchedAt) })}
              </span>
            )}
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              {loading ? label("fetching") : label("refreshFeed")}
            </button>
          </div>
        </div>
      </div>

      {/* Browser mode banner */}
      {!IS_TAURI && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-start gap-3">
          <Globe className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
              {label("browserMode")}
            </p>
            <p className="text-xs text-amber-600/80 dark:text-amber-300/70 mt-0.5">
              {label("browserModeDesc")}
            </p>
          </div>
        </div>
      )}

      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">{label("totalArticles")}</p>
          <p className="text-2xl font-bold text-foreground">{items.length}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">{label("sources")}</p>
          <p className="text-2xl font-bold text-foreground">{sources.length}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">{label("categories")}</p>
          <p className="text-2xl font-bold text-foreground">{categories.length}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">{label("hnArticles")}</p>
          <p className="text-2xl font-bold text-foreground">{hnItems.length}</p>
        </div>
      </div>

      {/* Category Filters */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setFilter("all")}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
            filter === "all" ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          <Filter className="w-3 h-3" />
          All
        </button>
        {categories.map((cat) => {
          const color = CATEGORY_COLORS[cat] ?? "#888"
          const active = filter === cat
          return (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className="px-3 py-1.5 rounded-full text-xs font-semibold transition-colors"
              style={
                active
                  ? { backgroundColor: color, color: "#fff" }
                  : { backgroundColor: `${color}18`, color }
              }
            >
              {cat}
            </button>
          )
        })}
      </div>

      {/* Feed */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-muted/30 p-10 text-center">
            <Newspaper className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-semibold text-muted-foreground mb-1">No articles yet</p>
            <p className="text-xs text-muted-foreground mb-4">
              Click Refresh to pull the latest security news from all sources.
            </p>
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              {loading ? "Fetching..." : "Refresh Feed"}
            </button>
          </div>
        )}
        {filtered.map((item) => {
          const category = item.category || "General"
          const color = CATEGORY_COLORS[category] ?? "#888"
          return (
            <div
              key={item.id}
              role="link"
              tabIndex={0}
              onClick={async () => {
                if (IS_TAURI) {
                  safeOpen(item.url)
                } else {
                  window.open(item.url, "_blank")
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  if (IS_TAURI) {
                    safeOpen(item.url)
                  } else {
                    window.open(item.url, "_blank")
                  }
                }
              }}
              className="flex items-start gap-4 rounded-xl border border-border bg-card p-4 hover:border-primary/40 hover:shadow-sm transition-all group cursor-pointer"
            >
              <div className="flex-shrink-0 mt-0.5">
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: color }}
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                    style={{
                      backgroundColor: `${color}20`,
                      color,
                    }}
                  >
                    {category}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{item.source}</span>
                  <span className="text-[10px] text-muted-foreground">· {item.domain}</span>
                  <span className="text-[10px] text-muted-foreground">· {timeAgo(item.published_at)}</span>
                  {item.score > 0 && (
                    <span className="text-[10px] text-muted-foreground">· {item.score} pts</span>
                  )}
                </div>
                <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2">
                  {item.title}
                </h3>
              </div>
              <ExternalLink className="w-4 h-4 text-muted-foreground flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          )
        })}
      </div>
    </div>
  )
}
