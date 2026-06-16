"use client"

import {
  Settings, FlaskConical, Newspaper,
  Sun, Moon, RefreshCw, Download, Upload,
  Trash2, EyeOff, Maximize, Minimize,
  GraduationCap, Check, Palette, Bell,
} from "lucide-react"
import { useTheme, THEME_OPTIONS } from "./ThemeProvider"
import { usePersonality } from "./PersonalityProvider"
import { useOpsec } from "@/hooks/useOpsec"
import { MODE_OPTIONS } from "@/lib/personality"
import type { Theme } from "./ThemeProvider"
import type { CourseConfig } from "@/types/course"
import StreakChip from "./StreakChip"
import CourseSelector from "./CourseSelector"
import StudyTimer from "./StudyTimer"
import WallClock from "./WallClock"
import NotificationSettingsPanel from "./NotificationSettingsPanel"
import { Popover } from "./Popover"

export type AppHeaderActions = {
  showTip: () => void
  switchCourse: (id: string | null) => void
  setSelectedCourseIds: (ids: Set<string>) => void
  openPlanner: (courseId: string | null) => void
  openOnlineLabs: () => void
  toggleNews: () => void
  logTime: (minutes: number) => void
  toggleThemePicker: () => void
  closeThemePicker: () => void
  toggleModePicker: () => void
  closeModePicker: () => void
  toggleNotificationSettings: () => void
  closeNotificationSettings: () => void
  toggleFullscreen: () => void
  refresh: () => void
  backup: () => void
  reset: () => void
  restore: (file: File) => void
}

export type AppHeaderProps = {
  safeLogoSvg: string | null
  courses: CourseConfig[]
  activeCourseId: string | null
  selectedCourseIds: Set<string>
  isNewsOpen: boolean
  isFullscreen: boolean
  refreshing: boolean
  showThemePicker: boolean
  showModePicker: boolean
  showNotificationSettings: boolean
  themePopoverRef: React.RefObject<HTMLDivElement | null>
  modePopoverRef: React.RefObject<HTMLDivElement | null>
  notifPopoverRef: React.RefObject<HTMLDivElement | null>
  actions: AppHeaderActions
}

export default function AppHeader({
  safeLogoSvg,
  courses,
  activeCourseId,
  selectedCourseIds,
  isNewsOpen,
  isFullscreen,
  refreshing,
  showThemePicker,
  showModePicker,
  showNotificationSettings,
  themePopoverRef,
  modePopoverRef,
  notifPopoverRef,
  actions,
}: AppHeaderProps) {
  const { theme, setTheme } = useTheme()
  const { label, toast: tToast, mode, setMode } = usePersonality()
  const { opsec, setOpsec } = useOpsec()

  return (
    <header
      role="banner"
      className="sticky top-0 z-30 border-b border-border bg-card/90 backdrop-blur-sm shadow-sm"
    >
      <div className="w-full px-4 py-3 flex items-center gap-4">
        {/* Logo + Title */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="w-9 h-9 flex items-center justify-center flex-shrink-0">
            {safeLogoSvg ? (
              <div
                dangerouslySetInnerHTML={{ __html: safeLogoSvg }}
                className="w-9 h-9"
                style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.2))" }}
              />
            ) : (
              <GraduationCap className="w-9 h-9 text-primary" />
            )}
          </div>
          <div className="hidden sm:block whitespace-nowrap">
            <h1 className="font-bold text-foreground leading-none whitespace-nowrap text-base">
              ZeroTrust.StudyForcer
              <span className="ml-2 text-[10px] font-normal text-muted-foreground bg-muted px-1.5 py-0.5 rounded">v{__APP_VERSION__}</span>
            </h1>
          </div>

          <StreakChip className="hidden sm:inline-flex" />
        </div>

        {/* Course selector */}
        {courses.length > 1 && (
          <div className="hidden md:flex items-center gap-2 flex-shrink-0">
            <CourseSelector
              courses={courses}
              activeCourseId={activeCourseId}
              selectedCourseIds={selectedCourseIds}
              onActiveChange={(id) => actions.switchCourse(id)}
              onSelectedChange={actions.setSelectedCourseIds}
              onOpenPlanner={actions.openPlanner}
            />
          </div>
        )}

        {/* Planner / Labs / News */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => actions.openPlanner(activeCourseId)}
            className="h-9 inline-flex items-center gap-1.5 px-3 rounded-lg border border-border bg-background text-foreground text-sm font-medium hover:bg-muted transition-all"
          >
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">{label("planner")}</span>
          </button>

          <button
            onClick={actions.openOnlineLabs}
            className="h-9 hidden lg:inline-flex items-center gap-1.5 px-3 rounded-lg border border-border bg-background text-foreground text-sm font-medium hover:bg-muted transition-all"
          >
            <FlaskConical className="w-4 h-4" />
            <span className="hidden sm:inline">{label("onlineLabs")}</span>
          </button>

          <button
            onClick={actions.toggleNews}
            className={`h-9 hidden lg:inline-flex items-center gap-1.5 px-3 rounded-lg border text-sm font-medium transition-all ${isNewsOpen
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border bg-background text-foreground hover:bg-muted"
              }`}
          >
            <Newspaper className="w-4 h-4" />
            <span className="hidden sm:inline">{label("news")}</span>
          </button>
        </div>

        <div className="flex-1" />

        {/* Timer */}
        <div className="flex-shrink-0">
          <StudyTimer onLogTime={actions.logTime} />
        </div>

        <div className="flex-1" />

        {/* Right toolbar */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <WallClock />
          <button
            onClick={actions.showTip}
            aria-label={label("tips")}
            className="w-9 h-9 flex items-center justify-center rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
          >
            <span className="text-sm font-bold">?</span>
          </button>
          <button
            onClick={actions.refresh}
            aria-label={label("refresh")}
            className="w-9 h-9 flex items-center justify-center rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={actions.backup}
            className="w-9 h-9 flex items-center justify-center rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
            title={label("backupAll")}
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={actions.reset}
            className="w-9 h-9 flex items-center justify-center rounded-lg border border-destructive/30 bg-background hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
            title={label("resetAll")}
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <label
            className="w-9 h-9 flex items-center justify-center rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer"
            title={label("restoreBackup")}
          >
            <Upload className="w-4 h-4" />
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) actions.restore(file)
                e.target.value = ""
              }}
            />
          </label>

          {/* Theme picker */}
          <div className="relative">
            <button
              onClick={actions.toggleThemePicker}
              aria-label={label("chooseTheme")}
              aria-haspopup="menu"
              aria-expanded={showThemePicker}
              className="w-9 h-9 flex items-center justify-center rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
            >
              {theme === "dark" || theme === "dark-grey" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>
            {showThemePicker && (
              <Popover
                open={showThemePicker}
                onClose={actions.closeThemePicker}
                role="menu"
                ariaLabel="Theme"
                widthClass="w-48"
              >
                <div ref={themePopoverRef as React.RefObject<HTMLDivElement>}>
                  <div className="px-2 py-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                    <Palette className="w-3.5 h-3.5" />
                    {label("theme")}
                  </div>
                  {THEME_OPTIONS.map((opt: { id: Theme; label: string; swatch: string }) => {
                    const active = theme === opt.id
                    return (
                      <button
                        key={opt.id}
                        role="menuitemradio"
                        aria-checked={active}
                        onClick={() => { setTheme(opt.id as Theme); actions.closeThemePicker() }}
                        className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm transition-colors ${active
                            ? "bg-muted font-medium text-foreground"
                            : "text-foreground hover:bg-muted/60"
                          }`}
                      >
                        <span
                          className="w-4 h-4 rounded-full border border-border flex-shrink-0"
                          style={{ backgroundColor: opt.swatch }}
                        />
                        <span className="flex-1 text-left">{opt.label}</span>
                        {active && <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />}
                      </button>
                    )
                  })}
                </div>
              </Popover>
            )}
          </div>

          {/* Personality mode switch */}
          <div className="relative">
            <button
              onClick={actions.toggleModePicker}
              aria-label={label("modeLabel")}
              aria-haspopup="menu"
              aria-expanded={showModePicker}
              className="w-9 h-9 flex items-center justify-center rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
              title={MODE_OPTIONS.find(m => m.id === mode)?.label ?? mode}
            >
              <span className="text-sm">{MODE_OPTIONS.find(m => m.id === mode)?.icon ?? "📋"}</span>
            </button>
            {showModePicker && (
              <Popover
                open={showModePicker}
                onClose={actions.closeModePicker}
                role="menu"
                ariaLabel="Personality mode"
                widthClass="w-56"
              >
                <div ref={modePopoverRef as React.RefObject<HTMLDivElement>}>
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">{label("modeLabel")}</div>
                  {MODE_OPTIONS.map((opt) => {
                    const active = mode === opt.id
                    return (
                      <button
                        key={opt.id}
                        role="menuitemradio"
                        aria-checked={active}
                        onClick={() => { setMode(opt.id); actions.closeModePicker() }}
                        className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm transition-colors ${active ? "bg-muted font-medium text-foreground" : "text-foreground hover:bg-muted/60"}`}
                      >
                        <span className="text-base">{opt.icon}</span>
                        <div className="flex-1 text-left">
                          <div className="text-sm">{opt.label}</div>
                          <div className="text-[10px] text-muted-foreground">{opt.tagline}</div>
                        </div>
                        {active && <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />}
                      </button>
                    )
                  })}
                </div>
              </Popover>
            )}
          </div>

          {/* Notification settings */}
          <div className="relative">
            <button
              onClick={actions.toggleNotificationSettings}
              aria-label={label("notificationTitle")}
              aria-haspopup="dialog"
              aria-expanded={showNotificationSettings}
              className="w-9 h-9 flex items-center justify-center rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
              title={label("notificationTitle")}
            >
              <Bell className="w-4 h-4" />
            </button>
            {showNotificationSettings && (
              <Popover
                open={showNotificationSettings}
                onClose={actions.closeNotificationSettings}
                role="dialog"
                ariaLabel={label("notificationTitle")}
                widthClass="w-80"
              >
                <div ref={notifPopoverRef as React.RefObject<HTMLDivElement>}>
                  <NotificationSettingsPanel />
                </div>
              </Popover>
            )}
          </div>

          {/* OPSEC toggle */}
          <button
            onClick={() => setOpsec(!opsec)}
            aria-label={label("opsecToggle")}
            aria-pressed={opsec}
            title={label("opsecToggle")}
            className={
              opsec
                ? "w-9 h-9 flex items-center justify-center rounded-lg border border-red-500/50 bg-red-500/10 text-red-600 dark:text-red-400 transition-all"
                : "w-9 h-9 flex items-center justify-center rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
            }
          >
            <EyeOff className="w-4 h-4" />
          </button>

          <button
            onClick={actions.toggleFullscreen}
            aria-label={label("toggleFullscreen")}
            className="w-9 h-9 hidden sm:flex items-center justify-center rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </header>
  )
}
