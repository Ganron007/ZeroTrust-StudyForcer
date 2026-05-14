export type LabCategory = "blue" | "red" | "dfir" | "purple"

export const CATEGORY_LABELS: Record<LabCategory, string> = {
  blue: "Blue Team",
  red: "Red Team",
  dfir: "DFIR",
  purple: "Purple",
}

export const CATEGORY_COLORS: Record<LabCategory, string> = {
  blue: "#2563EB",
  red: "#DC2626",
  dfir: "#0891B2",
  purple: "#9333EA",
}
