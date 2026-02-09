"use client"

import { Play } from "lucide-react"

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 h-14 border-b border-border bg-card/80 backdrop-blur-sm md:h-16">
      <div className="mx-auto flex h-full max-w-[960px] items-center justify-between px-4 md:px-6">
        <a href="/" className="flex items-center gap-2" aria-label="YouTube Summarizer - главная">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent">
            <Play className="h-4 w-4 text-accent-foreground" />
          </div>
          <span className="text-base font-semibold text-foreground">
            Summarizer
          </span>
        </a>

        <nav className="flex items-center gap-6">
          <a
            href="#"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            О проекте
          </a>
          <a
            href="#"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Конфиденциальность
          </a>
        </nav>
      </div>
    </header>
  )
}
