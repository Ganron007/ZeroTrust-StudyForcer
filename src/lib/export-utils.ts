// Client-side file download helpers (works in Tauri + browser dev mode)

export function downloadJson(filename: string, data: unknown) {
  // S22: catch JSON.stringify errors (circular refs, BigInt, etc.)
  let json: string
  try {
    json = JSON.stringify(data, null, 2)
  } catch (e) {
    console.error("[export-utils] JSON.stringify failed:", e)
    return
  }
  const blob = new Blob([json], { type: "application/json" })
  downloadBlob(filename, blob)
}

export function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((r) => r.map(escapeCsv).join(",")).join("\n")
  const blob = new Blob([csv], { type: "text/csv" })
  downloadBlob(filename, blob)
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  // S21: guard against missing document.body
  if (!document.body) {
    console.warn("[export-utils] No document.body available")
    URL.revokeObjectURL(url)
    return
  }
  document.body.appendChild(a)
  try {
    a.click()
  } catch (e) {
    console.error("[export-utils] a.click() failed:", e)
  } finally {
    // S19: ensure cleanup even if click throws
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }
}

export function escapeCsv(val: string | number): string {
  const s = String(val)
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export async function readJsonFile(file: File): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        resolve(JSON.parse(String(reader.result)))
      } catch (e) {
        reject(e)
      }
    }
    // S20: wrap raw ProgressEvent in meaningful Error
    reader.onerror = () => reject(new Error(`FileReader error reading ${file.name}`))
    reader.readAsText(file)
  })
}
