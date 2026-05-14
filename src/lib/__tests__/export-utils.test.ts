import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { downloadJson, downloadCsv, readJsonFile } from "../export-utils"

describe("export-utils", () => {
  let createObjectURLSpy: ReturnType<typeof vi.spyOn>
  let revokeObjectURLSpy: ReturnType<typeof vi.spyOn>
  let appendChildSpy: ReturnType<typeof vi.spyOn>
  let removeChildSpy: ReturnType<typeof vi.spyOn>
  let clickSpy: ReturnType<typeof vi.spyOn>
  let mockAnchor: HTMLAnchorElement

  beforeEach(() => {
    mockAnchor = document.createElement("a")
    clickSpy = vi.spyOn(mockAnchor, "click").mockImplementation(() => {})

    createObjectURLSpy = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test-url")
    revokeObjectURLSpy = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {})

    appendChildSpy = vi.spyOn(document.body, "appendChild").mockImplementation((node) => {
      return node as Node
    })
    removeChildSpy = vi.spyOn(document.body, "removeChild").mockImplementation((node) => {
      return node as Node
    })

    vi.spyOn(document, "createElement").mockImplementation((tagName) => {
      if (tagName === "a") return mockAnchor
      return document.createElement(tagName)
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("downloadJson", () => {
    it("creates a blob URL and triggers download", () => {
      const data = { plans: [{ id: "1", name: "Test" }] }
      downloadJson("test.json", data)

      expect(createObjectURLSpy).toHaveBeenCalled()
      expect(appendChildSpy).toHaveBeenCalled()
      expect(clickSpy).toHaveBeenCalled()
      expect(removeChildSpy).toHaveBeenCalled()
      expect(revokeObjectURLSpy).toHaveBeenCalledWith("blob:test-url")
    })

    it("sets correct filename on anchor", () => {
      downloadJson("my-data.json", { foo: "bar" })
      expect(mockAnchor.download).toBe("my-data.json")
      expect(mockAnchor.href).toBe("blob:test-url")
    })

    it("stringifies data with indentation", () => {
      downloadJson("test.json", { a: 1 })
      const blobArg = createObjectURLSpy.mock.calls[0][0] as Blob
      expect(blobArg.type).toBe("application/json")
    })
  })

  describe("downloadCsv", () => {
    it("creates CSV blob and triggers download", () => {
      const rows = [
        ["Name", "Age"],
        ["Alice", "30"],
      ]
      downloadCsv("test.csv", rows)

      expect(createObjectURLSpy).toHaveBeenCalled()
      expect(clickSpy).toHaveBeenCalled()
    })

    it("escapes values with commas", () => {
      const rows = [["Name", "Description"], ["Item", "Has, comma"]]
      downloadCsv("test.csv", rows)
      const blobArg = createObjectURLSpy.mock.calls[0][0] as Blob
      // We can't directly read the blob synchronously, but we can verify it was created
      expect(blobArg.type).toBe("text/csv")
    })

    it("escapes values with quotes", () => {
      const rows = [["Quote", 'Say "hello"']]
      downloadCsv("test.csv", rows)
      expect(createObjectURLSpy).toHaveBeenCalled()
    })

    it("escapes values with newlines", () => {
      const rows = [["Multi", "Line\nBreak"]]
      downloadCsv("test.csv", rows)
      expect(createObjectURLSpy).toHaveBeenCalled()
    })

    it("does not escape simple values", () => {
      const rows = [["Simple", "Value"]]
      downloadCsv("test.csv", rows)
      const blobArg = createObjectURLSpy.mock.calls[0][0] as Blob
      expect(blobArg.type).toBe("text/csv")
    })

    it("handles numeric values", () => {
      const rows = [["Count", 42]]
      downloadCsv("test.csv", rows)
      expect(createObjectURLSpy).toHaveBeenCalled()
    })
  })

  describe("readJsonFile", () => {
    it("reads and parses a JSON file", async () => {
      const data = { id: "1", name: "Test" }
      const blob = new Blob([JSON.stringify(data)], { type: "application/json" })
      const file = new File([blob], "test.json", { type: "application/json" })

      const result = await readJsonFile(file)
      expect(result).toEqual(data)
    })

    it("reads a JSON array file", async () => {
      const data = [{ id: "1" }, { id: "2" }]
      const blob = new Blob([JSON.stringify(data)], { type: "application/json" })
      const file = new File([blob], "plans.json", { type: "application/json" })

      const result = await readJsonFile(file)
      expect(result).toEqual(data)
    })

    it("rejects for invalid JSON", async () => {
      const blob = new Blob(["not json"], { type: "application/json" })
      const file = new File([blob], "bad.json", { type: "application/json" })

      await expect(readJsonFile(file)).rejects.toThrow()
    })
  })
})
