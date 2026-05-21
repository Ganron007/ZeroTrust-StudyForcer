import { useState, useEffect } from "react"
import { Newspaper } from "lucide-react"
import { readNewsCache, fetchNews, timeAgo, type NewsItem } from "@/lib/news-storage"
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
      setArticles(cache.items.slice(0, 5))
      setLoaded(true)
    })

    // A63: Actually update articles from fresh fetch instead of discarding the result
    fetchNews().then((fresh) => {
      if (cancelled) return
      setArticles(fresh.slice(0, 5))
    }).catch(() => {
      // Cache will remain — that's fine
    })

    return () => { cancelled = true }
  }, [])

  return (
    <div className="mb-5 p-4 rounded-xl bg-card border border-border">
      <div className="flex items-center gap-2 mb-3">
        <Newspaper className="w-4 h-4 text-primary" />
        <p className="text-sm font-semibold text-foreground">{label("securityNews")}</p>
      </div>
      {!loaded ? (
        <p className="text-xs text-muted-foreground">{loading("news")}</p>
      ) : articles.length === 0 ? (
        <p className="text-xs text-muted-foreground">{label("noNewsYet")}</p>
      ) : (
        <ul className="space-y-2 mb-3">
          {articles.map((a) => (
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
                    import("@tauri-apps/plugin-shell").then((shell) => {
                      shell.open(a.url)
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
      {loaded && articles.length > 0 && (
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
