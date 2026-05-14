import { useState, useEffect } from "react"
import { Newspaper } from "lucide-react"
import { readNewsCache, fetchNews, timeAgo, type NewsItem } from "@/lib/news-storage"

interface SidebarNewsHighlightsProps {
  onOpenNews: () => void
}

export default function SidebarNewsHighlights({ onOpenNews }: SidebarNewsHighlightsProps) {
  const [articles, setArticles] = useState<NewsItem[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    readNewsCache().then((cache) => {
      setArticles(cache.items.slice(0, 5))
      setLoaded(true)
    })
    fetchNews().catch(() => {})
  }, [])

  return (
    <div className="mb-5 p-4 rounded-xl bg-card border border-border">
      <div className="flex items-center gap-2 mb-3">
        <Newspaper className="w-4 h-4 text-primary" />
        <p className="text-sm font-semibold text-foreground">Security News</p>
      </div>
      {!loaded ? (
        <p className="text-xs text-muted-foreground">Loading...</p>
      ) : articles.length === 0 ? (
        <p className="text-xs text-muted-foreground">No news yet</p>
      ) : (
        <ul className="space-y-2 mb-3">
          {articles.map((a) => (
            <li key={a.id}>
              <a
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
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
          Open News Feed
        </button>
      )}
    </div>
  )
}
