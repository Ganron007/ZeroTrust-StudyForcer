import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("../is-tauri", () => ({ IS_TAURI: false }))

import {
  parseRss,
  urlToDomain,
  timeAgo,
  readNewsCache,
} from "../news-storage"

describe("urlToDomain", () => {
  it("extracts hostname from full URL", () => {
    expect(urlToDomain("https://www.bleepingcomputer.com/feed/")).toBe("bleepingcomputer.com")
  })

  it("strips www prefix", () => {
    expect(urlToDomain("https://www.schneier.com/feed/")).toBe("schneier.com")
  })

  it("handles URLs without www", () => {
    expect(urlToDomain("https://isc.sans.edu/rssfeed_full.xml")).toBe("isc.sans.edu")
  })

  it("falls back to split for invalid URLs", () => {
    expect(urlToDomain("not-a-url")).toBe("not-a-url")
  })

  it("handles URL with path and protocol", () => {
    expect(urlToDomain("https://example.com/path/to/page")).toBe("example.com")
  })
})

describe("parseRss", () => {
  it("parses RSS 2.0 items", () => {
    const xml = `<?xml version="1.0"?>
      <rss version="2.0"><channel>
        <item>
          <title>First Article</title>
          <link>https://example.com/1</link>
          <pubDate>Mon, 10 Jun 2026 12:00:00 GMT</pubDate>
        </item>
        <item>
          <title>Second Article</title>
          <link>https://example.com/2</link>
          <pubDate>Tue, 11 Jun 2026 12:00:00 GMT</pubDate>
        </item>
      </channel></rss>`

    const items = parseRss(xml)
    expect(items).toHaveLength(2)
    expect(items[0].title).toBe("First Article")
    expect(items[0].link).toBe("https://example.com/1")
    expect(items[0].isoDate).toBe("2026-06-10T12:00:00.000Z")
  })

  it("falls back to guid with isPermaLink=true when link is missing", () => {
    const xml = `<?xml version="1.0"?>
      <rss version="2.0"><channel>
        <item>
          <title>Guid Article</title>
          <guid isPermaLink="true">https://example.com/guid-link</guid>
          <pubDate>Mon, 10 Jun 2026 12:00:00 GMT</pubDate>
        </item>
      </channel></rss>`

    const items = parseRss(xml)
    expect(items).toHaveLength(1)
    expect(items[0].link).toBe("https://example.com/guid-link")
  })

  it("skips items without title or link", () => {
    const xml = `<?xml version="1.0"?>
      <rss version="2.0"><channel>
        <item><title>Has Title</title><link>https://example.com/ok</link><pubDate>Mon, 10 Jun 2026 12:00:00 GMT</pubDate></item>
        <item><title>No Link</title></item>
        <item><link>https://example.com/no-title</link></item>
      </channel></rss>`

    const items = parseRss(xml)
    expect(items).toHaveLength(1)
  })

  it("keeps raw pubDate string if unparseable (S14)", () => {
    const xml = `<?xml version="1.0"?>
      <rss version="2.0"><channel>
        <item>
          <title>Bad Date</title>
          <link>https://example.com/bad-date</link>
          <pubDate>not-a-date</pubDate>
        </item>
      </channel></rss>`

    const items = parseRss(xml)
    expect(items).toHaveLength(1)
    expect(items[0].isoDate).toBe("not-a-date")
  })

  it("parses Atom entries", () => {
    const xml = `<?xml version="1.0"?>
      <feed xmlns="http://www.w3.org/2005/Atom">
        <entry>
          <title>Atom Entry</title>
          <link href="https://example.com/atom/1" />
          <published>2026-06-10T12:00:00Z</published>
        </entry>
      </feed>`

    const items = parseRss(xml)
    expect(items).toHaveLength(1)
    expect(items[0].title).toBe("Atom Entry")
    expect(items[0].link).toBe("https://example.com/atom/1")
  })

  it("throws on invalid XML", () => {
    expect(() => parseRss("not xml at all")).toThrow("Invalid XML")
  })

  it("returns empty for valid XML with no items", () => {
    const xml = `<?xml version="1.0"?><rss version="2.0"><channel></channel></rss>`
    const items = parseRss(xml)
    expect(items).toHaveLength(0)
  })
})

describe("timeAgo", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-06-15T12:00:00.000Z"))
  })

  it("returns empty string for empty input", () => {
    expect(timeAgo("")).toBe("")
  })

  it("returns original string for invalid date", () => {
    expect(timeAgo("not-a-date")).toBe("not-a-date")
  })

  it("returns 'just now' for < 60 seconds", () => {
    expect(timeAgo("2026-06-15T11:59:30.000Z")).toBe("just now")
  })

  it("returns minutes ago for < 1 hour", () => {
    expect(timeAgo("2026-06-15T11:30:00.000Z")).toBe("30m ago")
  })

  it("returns hours ago for < 1 day", () => {
    expect(timeAgo("2026-06-15T09:00:00.000Z")).toBe("3h ago")
  })

  it("returns days ago for < 1 week", () => {
    expect(timeAgo("2026-06-12T12:00:00.000Z")).toBe("3d ago")
  })

  it("returns formatted date for >= 1 week", () => {
    const result = timeAgo("2026-05-01T12:00:00.000Z")
    // toLocaleDateString output depends on TZ, just verify it's not empty/relative
    expect(result).toBeTruthy()
    expect(result).not.toMatch(/^\d+[mhd] ago$/)
    expect(result).not.toBe("just now")
  })
})

describe("readNewsCache", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it("returns empty cache when nothing stored", async () => {
    const cache = await readNewsCache()
    expect(cache.items).toHaveLength(0)
    expect(cache.fetched_at).toBe("")
  })

  it("returns valid cached items", async () => {
    const data = {
      items: [
        { id: "1", title: "Test", url: "https://example.com", source: "Test", domain: "example.com", published_at: "2026-06-10", score: 0 },
      ],
      fetched_at: "2026-06-10T12:00:00.000Z",
    }
    localStorage.setItem("web:news_cache", JSON.stringify(data))

    const cache = await readNewsCache()
    expect(cache.items).toHaveLength(1)
    expect(cache.items[0].title).toBe("Test")
    expect(cache.fetched_at).toBe("2026-06-10T12:00:00.000Z")
  })

  it("returns empty on corrupt JSON", async () => {
    localStorage.setItem("web:news_cache", "not json")
    const cache = await readNewsCache()
    expect(cache.items).toHaveLength(0)
    expect(cache.fetched_at).toBe("")
  })

  it("filters out invalid items (S9)", async () => {
    const data = {
      items: [
        { id: "1", title: "Valid", url: "https://example.com", source: "Test" },
        { id: 2, title: "Wrong id type", url: "https://example.com", source: "Test" },
        { id: "3", title: 123, url: "https://example.com", source: "Test" },
        { id: "4", title: "No url", source: "Test" },
        null,
        "string-item",
      ],
      fetched_at: "2026-06-10",
    }
    localStorage.setItem("web:news_cache", JSON.stringify(data))

    const cache = await readNewsCache()
    expect(cache.items).toHaveLength(1)
    expect(cache.items[0].title).toBe("Valid")
  })

  it("handles missing items array gracefully", async () => {
    localStorage.setItem("web:news_cache", JSON.stringify({ fetched_at: "2026-06-10" }))
    const cache = await readNewsCache()
    expect(cache.items).toHaveLength(0)
    expect(cache.fetched_at).toBe("2026-06-10")
  })
})
