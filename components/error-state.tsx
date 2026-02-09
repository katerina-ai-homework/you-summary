"use client"

import { useState } from "react"
import { AlertCircle, ClipboardPaste } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

interface ErrorStateProps {
  errorType: "invalid_url" | "unavailable" | "no_transcript"
  onReset: () => void
  onSubmitTranscript: (text: string) => void
}

const ERROR_MESSAGES: Record<
  ErrorStateProps["errorType"],
  { title: string; description: string }
> = {
  invalid_url: {
    title: "Некорректная ссылка",
    description:
      "Введённая ссылка не похожа на YouTube URL. Проверьте и попробуйте снова.",
  },
  unavailable: {
    title: "Видео недоступно",
    description:
      "Это видео может быть приватным, удалённым или ограниченным в вашем регионе.",
  },
  no_transcript: {
    title: "Транскрипт недоступен",
    description:
      "Не удалось найти субтитры для этого видео. Вы можете вставить транскрипт вручную.",
  },
}

export function ErrorState({
  errorType,
  onReset,
  onSubmitTranscript,
}: ErrorStateProps) {
  const [transcript, setTranscript] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const error = ERROR_MESSAGES[errorType]

  function handleSubmitTranscript() {
    if (transcript.trim()) {
      setDialogOpen(false)
      onSubmitTranscript(transcript)
    }
  }

  return (
    <div className="flex flex-col items-center gap-8 px-4 py-16 md:py-24">
      <Card className="w-full max-w-xl border-border bg-card shadow-sm">
        <CardContent className="flex flex-col items-center gap-5 p-6 text-center md:p-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertCircle className="h-6 w-6 text-destructive" />
          </div>

          <div className="flex flex-col gap-1.5">
            <h2 className="text-xl font-semibold text-foreground">
              {"Не удалось суммировать"}
            </h2>
            <p className="text-sm text-muted-foreground">{error.description}</p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              onClick={onReset}
              className="rounded-xl bg-accent text-accent-foreground hover:bg-accent/80"
            >
              Попробовать другую ссылку
            </Button>

            {errorType === "no_transcript" && (
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="rounded-xl border-border bg-transparent"
                  >
                    <ClipboardPaste className="h-4 w-4" />
                    Вставить транскрипт
                  </Button>
                </DialogTrigger>
                <DialogContent className="rounded-2xl sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Вставить транскрипт</DialogTitle>
                    <DialogDescription>
                      Вставьте полный текст транскрипта видео ниже.
                    </DialogDescription>
                  </DialogHeader>
                  <Textarea
                    value={transcript}
                    onChange={(e) => setTranscript(e.target.value)}
                    placeholder="Вставьте транскрипт сюда..."
                    className="min-h-[200px] rounded-xl border-border"
                    aria-label="Транскрипт видео"
                  />
                  <DialogFooter>
                    <Button
                      onClick={handleSubmitTranscript}
                      disabled={!transcript.trim()}
                      className="rounded-xl bg-accent text-accent-foreground hover:bg-accent/80"
                    >
                      Суммировать текст
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
