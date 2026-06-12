import { useState, useEffect, useMemo } from "react"
import { Newspaper, Shield } from "lucide-react"
import {
  readNewsCache, fetchNews, timeAgo,
  findCveOfTheDay, extractCveId,
  type NewsItem,
} from "@/lib/news-storage"
import { IS_TAURI } from "@/lib/is-tauri"
import { usePersonality } from "./PersonalityProvider"

interface SidebarNewsHighlightsProps {
  onOpenNews: () => void
}

export default function SidebarNewsHighlights({ onOpenNews }: SidebarNewsHighlightsProps) {
  const { label, loading } = usePersonality()
  const [articles, setArticles] = useState<NewsItem[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false

    // A63: Load cache first for instant display
    readNewsCache().then((cache) => {
      if (cancelled) return
      setArticles(cache.items.slice(0, 30))  // Load more so CVE picker has range
      setLoaded(true)
    })

    // A63: Actually update articles from fresh fetch instead of discarding the result
    fetchNews().then((fresh) => {
      if (cancelled) return
      setArticles(fresh.slice(0, 30))
    }).catch(() => {
      // Cache will remain — that's fine
    })

    return () => { cancelled = true }
  }, [])

  // Phase 0.5.10: CVE-of-the-day chip
  const cveOfTheDay = useMemo(() => findCveOfTheDay(articles), [articles])
  // Articles excluding the CVE (which is shown separately)
  const otherArticles = useMemo(
    () => (cveOfTheDay ? articles.filter((a) => a.id !== cveOfTheDay.id) : articles).slice(0, 5),
    [articles, cveOfTheDay],
  )

  return (
    <div className="mb-5 p-4 rounded-xl bg-card border border-border">
      <div className="flex items-center gap-2 mb-3">
        <Newspaper className="w-4 h-4 text-primary" />
        <p className="text-sm font-semibold text-foreground">{label("securityNews")}</p>
      </div>

      {/* Phase 0.5.10: CVE-of-the-day chip */}
      {loaded && cveOfTheDay && (
        <div className="mb-3 p-2 rounded-lg border border-red-500/30 bg-red-500/5 cve-chip-highlight">
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-3 h-3 text-red-500 flex-shrink-0" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-red-600 dark:text-red-400">
              {label("cveOfTheDay")}
            </span>
            {extractCveId(cveOfTheDay.title) && (
              <span className="text-[10px] font-mono font-semibold text-red-700 dark:text-red-300">
                {extractCveId(cveOfTheDay.title)}
              </span>
            )}
          </div>
          <a
            href={cveOfTheDay.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              if (IS_TAURI) {
                e.preventDefault()
                const url = cveOfTheDay.url.trim()
                if (!/^https:\/\/[^\s/$.?#].[^\s]*$/i.test(url)) return
                import("@tauri-apps/plugin-shell").then((shell) => shell.open(url))
              }
            }}
            className="block text-xs text-foreground hover:text-red-600 dark:hover:text-red-300 transition-colors leading-snug font-medium"
          >
            {cveOfTheDay.title.replace(/CVE-\d{4}-\d{4,7}/i, "").trim() || cveOfTheDay.title}
          </a>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {cveOfTheDay.source} · {timeAgo(cveOfTheDay.published_at)}
          </p>
        </div>
      )}

      {!loaded ? (
        <p className="text-xs text-muted-foreground">{loading("news")}</p>
      ) : otherArticles.length === 0 && !cveOfTheDay ? (
        <p className="text-xs text-muted-foreground">{label("noNewsYet")}</p>
      ) : (
        <ul className="space-y-2 mb-3">
          {otherArticles.map((a) => (
            <li key={a.id}>
              {/* A82: In Tauri mode, use shell.open instead of bare <a> which
                  doesn't work in Tauri's WebView (CSP-blocked). */}
              <a
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                    if (IS_TAURI) {
                      e.preventDefault()
                      // v2.4.6 (M-29): validate URL before passing to shell.open
                      // to prevent file:// or javascript: URL injection from RSS feeds.
                      const url = a.url.trim()
                      if (!/^https:\/\/[^\s/$.?#].[^\s]*$/i.test(url)) {
                        console.warn("[SidebarNewsHighlights] blocked non-https URL:", url)
                        return
                      }
                      import("@tauri-apps/plugin-shell").then((shell) => {
                        shell.open(url)
                      })
                    }
                }}
                className="block text-xs text-foreground hover:text-primary transition-colors leading-snug"
              >
                {a.title}
              </a>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {a.source} · {timeAgo(a.published_at)}
              </p>
            </li>
          ))}
        </ul>
      )}
      {loaded && otherArticles.length > 0 && (
        <button
          onClick={onOpenNews}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-all"
        >
          <Newspaper className="w-3 h-3" />
          {label("openNewsFeed")}
        </button>
      )}
    </div>
  )
}
