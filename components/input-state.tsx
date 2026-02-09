"use client"

import { useState } from "react"
import { Link2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface InputStateProps {
  onSubmit: (url: string) => void
}

export function InputState({ onSubmit }: InputStateProps) {
  const [url, setUrl] = useState("")
  const [error, setError] = useState("")

  function validateUrl(value: string): boolean {
    const ytRegex =
      /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|shorts\/|embed\/)|youtu\.be\/)[a-zA-Z0-9_-]+/
    return ytRegex.test(value)
  }

  function handleSubmit() {
    if (!url.trim()) {
      setError("Введите ссылку на YouTube")
      return
    }
    if (!validateUrl(url)) {
      setError("Введите корректную ссылку на YouTube")
      return
    }
    setError("")
    onSubmit(url)
  }

  return (
    <div className="flex flex-col items-center gap-8 px-4 py-16 md:py-24">
      <div className="flex max-w-2xl flex-col items-center gap-4 text-center">
        <h1 className="text-balance text-4xl font-semibold leading-tight text-foreground md:text-[44px]">
          Краткое содержание любого видео
        </h1>
        <p className="text-pretty text-lg text-muted-foreground">
          Вставьте ссылку и получите сжатый пересказ с ключевыми тезисами.
        </p>
      </div>

      <div className="flex w-full max-w-xl flex-col gap-3">
        <div className="flex flex-col gap-2 md:flex-row">
          <div className="relative flex-1">
            <Link2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="url"
              placeholder="https://www.youtube.com/watch?v=..."
              value={url}
              onChange={(e) => {
                setUrl(e.target.value)
                if (error) setError("")
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSubmit()
              }}
              className={`h-12 rounded-xl border bg-card pl-10 text-base shadow-sm transition-shadow placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-ring ${
                error ? "border-destructive" : "border-border"
              }`}
              aria-label="Ссылка на YouTube видео"
              aria-invalid={!!error}
            />
          </div>
          <Button
            onClick={handleSubmit}
            className="h-12 rounded-xl bg-accent px-6 text-base font-medium text-accent-foreground shadow-sm transition-colors hover:bg-accent/80"
          >
            Суммировать
          </Button>
        </div>

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <p className="text-center text-sm text-muted-foreground">
          Лучше всего работает, когда у видео есть субтитры.
        </p>
      </div>
    </div>
  )
}
