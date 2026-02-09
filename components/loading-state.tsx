"use client"

import { useEffect, useState } from "react"
import { Check, Loader2, Circle, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"

interface LoadingStateProps {
  url: string
  onCancel: () => void
  onComplete: (result: {
    summary: string
    keyPoints: string[]
    confidence: number
  }) => void
  onError: (error: string) => void
}

const STEPS = [
  { label: "Получаем информацию о видео", stage: "transcript" },
  { label: "Читаем транскрипт", stage: "transcript" },
  { label: "Пишем краткое содержание", stage: "summarize" },
]

interface JobStatusResponse {
  jobId: string
  status: "processing" | "completed" | "failed"
  stage?: "transcript" | "summarize"
  result?: {
    summary: string
    keyPoints: string[]
    confidence: number
  }
  error?: {
    code: string
    message: string
  }
}

export function LoadingState({ url, onCancel, onComplete, onError }: LoadingStateProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let pollInterval: NodeJS.Timeout | null = null

    async function processVideo() {
      try {
        console.log("[DEBUG] Creating job for URL:", url)

        // Step 1: Create job
        const createResponse = await fetch("/api/v1/summaries", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            url,
            title: "",
            lang: "ru",
            options: {
              length: "standard",
              format: "bullets",
            },
          }),
        })

        if (cancelled) return

        if (!createResponse.ok) {
          const errorData = await createResponse.json()
          console.error("[DEBUG] Failed to create job:", errorData)
          throw new Error(errorData.error?.message || "Failed to create job")
        }

        const data = await createResponse.json()
        console.log("[DEBUG] Job created:", data)

        if (cancelled) return

        // If job is already completed (cached), return result immediately
        if (data.status === "completed" && data.result) {
          console.log("[DEBUG] Job already completed (cached)")
          onComplete(data.result)
          return
        }

        const jobId = data.jobId
        setCurrentStep(1)
        setProgress(33)

        // Step 2: Poll for job status
        pollInterval = setInterval(async () => {
          if (cancelled) {
            if (pollInterval) clearInterval(pollInterval)
            return
          }

          try {
            console.log("[DEBUG] Polling job status:", jobId)

            const statusResponse = await fetch(`/api/v1/summaries/${jobId}`)

            if (cancelled) return

            if (!statusResponse.ok) {
              const errorData = await statusResponse.json()
              console.error("[DEBUG] Failed to get job status:", errorData)
              throw new Error(errorData.error?.message || "Failed to get job status")
            }

            const statusData: JobStatusResponse = await statusResponse.json()
            console.log("[DEBUG] Job status:", statusData)

            if (cancelled) return

            // Update progress based on stage
            if (statusData.stage === "transcript") {
              setCurrentStep(1)
              setProgress(50)
            } else if (statusData.stage === "summarize") {
              setCurrentStep(2)
              setProgress(75)
            }

            // Check if job is completed
            if (statusData.status === "completed" && statusData.result) {
              console.log("[DEBUG] Job completed successfully")
              if (pollInterval) {
                clearInterval(pollInterval)
                pollInterval = null
              }
              if (!cancelled) {
                setProgress(100)
                onComplete(statusData.result)
              }
              return
            }

            // Check if job failed
            if (statusData.status === "failed") {
              console.error("[DEBUG] Job failed:", statusData.error)
              if (pollInterval) {
                clearInterval(pollInterval)
                pollInterval = null
              }
              if (!cancelled) {
                const errorMessage = statusData.error?.message || "Failed to process video"
                setError(errorMessage)
                onError(errorMessage)
              }
              return
            }
          } catch (err) {
            console.error("[DEBUG] Error polling job status:", err)
            if (pollInterval) {
              clearInterval(pollInterval)
              pollInterval = null
            }
            if (!cancelled) {
              const errorMessage = err instanceof Error ? err.message : "Failed to process video"
              setError(errorMessage)
              onError(errorMessage)
            }
            return
          }
        }, 2000)

      } catch (err) {
        console.error("[DEBUG] Error processing video:", err)
        if (!cancelled) {
          const errorMessage = err instanceof Error ? err.message : "Failed to process video"
          setError(errorMessage)
          onError(errorMessage)
        }
      }
    }

    processVideo()

    return () => {
      cancelled = true
      if (pollInterval) {
        clearInterval(pollInterval)
      }
    }
  }, [url, onComplete, onError])

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

          {error ? (
            <div className="flex items-center gap-3 rounded-lg bg-destructive/10 p-4 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <div className="flex-1">
                <p className="font-medium">Произошла ошибка</p>
                <p className="text-sm opacity-90">{error}</p>
              </div>
            </div>
          ) : (
            <>
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
            </>
          )}

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
