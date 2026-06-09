/// <reference types="vite/client" />

declare const __BUILD_DATE__: string
declare const __APP_VERSION__: string

// C4 fix: TypeScript declarations for the File System Access API used by
// ComplianceReport.tsx (showSaveFilePicker). Supported in Chromium-based
// browsers (Chrome, Edge) and Tauri's WebView2. Not in Firefox/Safari.
interface FileSystemWritableFileStream {
  write(data: string | BufferSource | Blob): Promise<void>
  close(): Promise<void>
}

interface FileSystemFileHandle {
  createWritable(): Promise<FileSystemWritableFileStream>
}

interface SaveFilePickerOptions {
  suggestedName?: string
  types?: Array<{
    description?: string
    accept: Record<string, string[]>
  }>
}

interface Window {
  showSaveFilePicker?: (options?: SaveFilePickerOptions) => Promise<FileSystemFileHandle>
}
