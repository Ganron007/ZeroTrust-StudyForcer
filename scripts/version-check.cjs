#!/usr/bin/env node
// Pre-commit hook: verify package.json and tauri.conf.json versions match.
// Usage: node scripts/version-check.cjs
// To install as git hook: cp scripts/version-check.cjs .git/hooks/pre-commit

const { readFileSync } = require("fs")
const { resolve } = require("path")

const root = __dirname + "/.."
const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf-8"))
const tauri = JSON.parse(readFileSync(resolve(root, "src-tauri/tauri.conf.json"), "utf-8"))

const pkgVer = pkg.version
const tauriVer = tauri.version

if (pkgVer !== tauriVer) {
  console.error("❌ Version mismatch!")
  console.error(`   package.json: ${pkgVer}`)
  console.error(`   tauri.conf.json: ${tauriVer}`)
  console.error("   Please bump both versions before committing.")
  process.exit(1)
}

console.error("✅ Versions in sync — OK to commit.")
process.exit(0)
