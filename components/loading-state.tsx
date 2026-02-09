"use client"

import { useEffect, useState } from "react"
import { Check, Loader2, Circle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"

interface LoadingStateProps {
  url: string
  onCancel: () => void
  onComplete: () => void
}

const STEPS = [
  { label: "Получаем информацию о видео", duration: 1200 },
  { label: "Читаем транскрипт", duration: 2000 },
  { label: "Пишем краткое содержание", duration: 2500 },
]

export function LoadingState({ url, onCancel, onComplete }: LoadingStateProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    let cancelled = false

    const totalDuration = STEPS.reduce((sum, s) => sum + s.duration, 0)
    let elapsed = 0

    function runStep(index: number) {
      if (cancelled || index >= STEPS.length) return

      const step = STEPS[index]
      const startTime = Date.now()

      const interval = setInterval(() => {
        if (cancelled) {
          clearInterval(interval)
          return
        }

        const stepElapsed = Date.now() - startTime
        const stepProgress = Math.min(stepElapsed / step.duration, 1)
        const totalProgress =
          ((elapsed + stepElapsed) / totalDuration) * 100

        setProgress(Math.min(totalProgress, 100))

        if (stepProgress >= 1) {
          clearInterval(interval)
          elapsed += step.duration

          if (index + 1 < STEPS.length) {
            setCurrentStep(index + 1)
            runStep(index + 1)
          } else {
            setProgress(100)
            setTimeout(() => {
              if (!cancelled) onComplete()
            }, 400)
          }
        }
      }, 50)
    }

    const timer = setTimeout(() => runStep(0), 300)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [onComplete])

  return (
    <div className="flex flex-col items-center gap-8 px-4 py-16 md:py-24">
      <Card className="w-full max-w-xl border-border bg-card shadow-sm">
        <CardContent className="flex flex-col gap-6 p-6 md:p-8">
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-semibold text-foreground md:text-2xl">
              Обрабатываем
            </h2>
            <p className="truncate text-sm text-muted-foreground">{url}</p>
          </div>

          <Progress
            value={progress}
            className="h-2 rounded-full bg-muted [&>div]:bg-accent [&>div]:transition-all"
          />

          <div className="flex flex-col gap-3" role="list" aria-label="Этапы обработки">
            {STEPS.map((step, index) => {
              const isComplete = index < currentStep
              const isCurrent = index === currentStep
              return (
                <div
                  key={step.label}
                  className="flex items-center gap-3"
                  role="listitem"
                >
                  {isComplete ? (
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-accent">
                      <Check className="h-3 w-3 text-accent-foreground" />
                    </div>
                  ) : isCurrent ? (
                    <Loader2 className="h-5 w-5 animate-spin text-accent-foreground" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground/40" />
                  )}
                  <span
                    className={`text-sm ${
                      isComplete
                        ? "text-muted-foreground"
                        : isCurrent
                          ? "font-medium text-foreground"
                          : "text-muted-foreground/60"
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              )
            })}
          </div>

          <Button
            variant="outline"
            onClick={onCancel}
            className="w-full rounded-xl border-border bg-transparent"
          >
            Отменить
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
