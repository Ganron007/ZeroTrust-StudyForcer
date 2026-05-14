"use client"

import { Lightbulb, X, ChevronRight } from "lucide-react"

interface TipPopupProps {
  tip: string
  tipNumber: number
  totalTips: number
  onNext: () => void
  onClose: () => void
}

export default function TipPopup({ tip, tipNumber, totalTips, onNext, onClose }: TipPopupProps) {
  return (
    <div className="fixed top-20 right-4 z-50 w-80 animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="bg-card border border-border rounded-xl shadow-2xl p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-amber-500 flex-shrink-0" />
            <span className="text-xs font-medium text-muted-foreground">
              Tip {tipNumber} of {totalTips}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <p className="text-sm text-foreground leading-relaxed mb-4">{tip}</p>
        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            {Array.from({ length: totalTips }, (_, i) => (
              <div
                key={i}
                className={`w-1.5 h-1.5 rounded-full ${
                  i < tipNumber ? "bg-amber-500" : "bg-muted-foreground/20"
                }`}
              />
            ))}
          </div>
          <button
            onClick={onNext}
            className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
          >
            Next tip
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  )
}
