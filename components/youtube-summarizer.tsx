"use client"

import { useState, useCallback } from "react"
import { InputState } from "@/components/input-state"
import { LoadingState } from "@/components/loading-state"
import { ResultState } from "@/components/result-state"
import { ErrorState } from "@/components/error-state"

type AppState = "input" | "loading" | "result" | "error"
type ErrorType = "invalid_url" | "unavailable" | "no_transcript"

export function YouTubeSummarizer() {
  const [state, setState] = useState<AppState>("input")
  const [url, setUrl] = useState("")
  const [errorType, setErrorType] = useState<ErrorType>("no_transcript")
  const [summaryResult, setSummaryResult] = useState<{
    summary: string
    keyPoints: string[]
    confidence: number
  } | null>(null)

  function handleSubmit(submittedUrl: string) {
    setUrl(submittedUrl)
    setState("loading")
  }

  const handleLoadingComplete = useCallback((result: {
    summary: string
    keyPoints: string[]
    confidence: number
  }) => {
    setSummaryResult(result)
    setState("result")
  }, [])

  const handleLoadingError = useCallback((error: string) => {
    console.error('[DEBUG] Loading error:', error)
    setErrorType("no_transcript")
    setState("error")
  }, [])

  function handleCancel() {
    setState("input")
  }

  function handleReset() {
    setUrl("")
    setState("input")
  }

  function handleSubmitTranscript(text: string) {
    setState("loading")
  }

  // For demo: simulate an error by adding ?error=type to test
  function handleSimulateError(type: ErrorType) {
    setErrorType(type)
    setState("error")
  }

  return (
    <main className="mx-auto min-h-[calc(100vh-56px)] max-w-[960px] md:min-h-[calc(100vh-64px)]">
      {state === "input" && <InputState onSubmit={handleSubmit} />}
      {state === "loading" && (
        <LoadingState
          url={url}
          onCancel={handleCancel}
          onComplete={handleLoadingComplete}
          onError={handleLoadingError}
        />
      )}
      {state === "result" && summaryResult && (
        <ResultState
          url={url}
          result={summaryResult}
          onReset={handleReset}
        />
      )}
      {state === "error" && (
        <ErrorState
          errorType={errorType}
          onReset={handleReset}
          onSubmitTranscript={handleSubmitTranscript}
        />
      )}
    </main>
  )
}
