import { useState } from "react"
import { Bell, BellOff, Clock, AlertOctagon } from "lucide-react"
import { usePersonality } from "./PersonalityProvider"
import {
  loadSettings,
  saveSettings,
  requestPermission,
  isNativeAvailable,
  type NotificationSettings,
} from "@/lib/notifications"
import {
  loadAdversarySettings,
  saveAdversarySettings,
  type AdversarySettings,
} from "@/lib/adversary"
import { showToast } from "./NotificationToast"

interface NotificationSettingsPanelProps {
  className?: string
}

/**
 * Phase 2.2: Native notification settings.
 *
 * - Toggle to enable/disable daily reminder notifications
 * - Pick a time of day (HH:MM)
 * - Toggle the at-risk labs alert
 *
 * In web/test mode, the toggle is disabled and a small "browser mode"
 * hint is shown — native notifications only work in the Tauri desktop app.
 */
export default function NotificationSettingsPanel({ className = "" }: NotificationSettingsPanelProps) {
  const { label, toast: tToast } = usePersonality()
  const [settings, setSettings] = useState<NotificationSettings>(() => loadSettings())
  const [adversary, setAdversary] = useState<AdversarySettings>(() => loadAdversarySettings())
  const native = isNativeAvailable()

  const handleToggle = async (next: NotificationSettings) => {
    setSettings(next)
    saveSettings(next)
    if (next.enabled && native) {
      const granted = await requestPermission()
      if (!granted) {
        setSettings({ ...next, enabled: false })
        saveSettings({ ...next, enabled: false })
        showToast(tToast("notificationPermissionDenied"), "break")
      } else {
        showToast(tToast("notificationEnabled"), "complete")
      }
    } else if (!next.enabled) {
      showToast(tToast("notificationDisabled"), "info")
    }
  }

  return (
    <div className={`border border-border rounded-xl bg-card/50 p-5 ${className}`}>
      <div className="flex items-center gap-2 mb-1">
        {settings.enabled ? (
          <Bell className="w-5 h-5 text-primary" />
        ) : (
          <BellOff className="w-5 h-5 text-muted-foreground" />
        )}
        <h2 className="text-lg font-bold text-foreground">{label("notificationTitle")}</h2>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        {label("notificationSubtitle")}
      </p>

      {!native && (
        <div className="mb-3 p-2 rounded-lg border border-amber-500/30 bg-amber-500/5">
          <p className="text-xs text-amber-600 dark:text-amber-400">
            {label("notificationBrowserModeHint")}
          </p>
        </div>
      )}

      <div className="space-y-3">
        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-sm font-medium text-foreground">{label("notificationEnable")}</span>
          <button
            type="button"
            role="switch"
            aria-checked={settings.enabled}
            disabled={!native}
            onClick={() => handleToggle({ ...settings, enabled: !settings.enabled })}
            data-testid="notification-toggle"
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              settings.enabled ? "bg-primary" : "bg-muted"
            } ${!native ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                settings.enabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </label>

        <label className={`flex items-center justify-between ${settings.enabled && native ? "" : "opacity-50"}`}>
          <span className="text-sm font-medium text-foreground flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            {label("notificationTime")}
          </span>
          <input
            type="time"
            value={settings.dailyTime}
            disabled={!settings.enabled || !native}
            onChange={(e) => {
              const next = { ...settings, dailyTime: e.target.value }
              setSettings(next)
              saveSettings(next)
            }}
            data-testid="notification-time"
            className="px-2 py-1 rounded border border-border bg-background text-foreground text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </label>

        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-sm font-medium text-foreground">{label("notificationLabsAlert")}</span>
          <button
            type="button"
            role="switch"
            aria-checked={settings.labsAlert}
            disabled={!settings.enabled || !native}
            onClick={() => {
              const next = { ...settings, labsAlert: !settings.labsAlert }
              setSettings(next)
              saveSettings(next)
            }}
            data-testid="notification-labs-toggle"
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              settings.labsAlert ? "bg-primary" : "bg-muted"
            } ${!settings.enabled || !native ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                settings.labsAlert ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </label>
      </div>

      {/* Phase 0.5.9: Adversary timer settings */}
      <div className="mt-5 pt-4 border-t border-border">
        <div className="flex items-center gap-2 mb-1">
          <AlertOctagon className="w-4 h-4 text-destructive" />
          <h3 className="text-sm font-semibold text-foreground">{label("adversaryTitle")}</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          {label("adversarySubtitle")}
        </p>
        <div className="space-y-3">
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm font-medium text-foreground">{label("adversaryEnable")}</span>
            <button
              type="button"
              role="switch"
              aria-checked={adversary.enabled}
              onClick={() => {
                const next = { ...adversary, enabled: !adversary.enabled }
                setAdversary(next)
                saveAdversarySettings(next)
              }}
              data-testid="adversary-toggle"
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                adversary.enabled ? "bg-destructive" : "bg-muted"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  adversary.enabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </label>
          <label className={`flex items-center justify-between ${adversary.enabled ? "" : "opacity-50"}`}>
            <span className="text-sm font-medium text-foreground flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              {label("adversaryDeadline")}
            </span>
            <input
              type="time"
              value={adversary.deadline}
              disabled={!adversary.enabled}
              onChange={(e) => {
                const next = { ...adversary, deadline: e.target.value }
                setAdversary(next)
                saveAdversarySettings(next)
              }}
              data-testid="adversary-deadline"
              className="px-2 py-1 rounded border border-border bg-background text-foreground text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </label>
          <label className={`flex items-center justify-between ${adversary.enabled ? "" : "opacity-50"}`}>
            <span className="text-sm font-medium text-foreground">{label("adversaryBoost")}</span>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={5}
                max={100}
                step={5}
                value={adversary.paceBoostPct}
                disabled={!adversary.enabled}
                onChange={(e) => {
                  const next = { ...adversary, paceBoostPct: Number(e.target.value) }
                  setAdversary(next)
                  saveAdversarySettings(next)
                }}
                data-testid="adversary-boost"
                className="w-24"
              />
              <span className="text-xs text-muted-foreground w-8">+{adversary.paceBoostPct}%</span>
            </div>
          </label>
        </div>
      </div>
    </div>
  )
}
