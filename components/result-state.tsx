"use client"

import { ExternalLink, Copy, Download, Share2, Clock, User, Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { toast } from "sonner"

interface ResultStateProps {
  url: string
  onReset: () => void
}

const MOCK_VIDEO = {
  title: "Как сформировать привычки, которые останутся навсегда",
  channel: "Пример канала",
  duration: "18:42",
}

const MOCK_SUMMARY = `В этом видео рассматривается наука формирования привычек и практические стратегии для устойчивых поведенческих изменений. Автор опирается на исследования из области поведенческой психологии, объясняя, почему большинство привычек не приживаются и что отличает временные изменения от постоянных.

Основная модель строится на трёх принципах: сделать привычку очевидной, привлекательной и простой для начала. Вместо того чтобы полагаться только на мотивацию, автор утверждает, что организация среды и снижение барьеров гораздо эффективнее. Маленькие «стартовые» привычки длительностью менее двух минут рекомендуются как отправная точка.

Видео завершается обсуждением систем подотчётности и методов отслеживания. Автор подчёркивает, что регулярность важнее интенсивности, а один пропущенный день наносит гораздо меньший ущерб, чем нарратив провала, который часто за ним следует.`

const MOCK_KEY_POINTS = [
  "Привычки формируются через системы, а не силу воли или мотивацию",
  "Организация среды — самый недооценённый фактор формирования привычек",
  "Начинайте с «двухминутной версии» любой привычки, чтобы снизить барьер",
  "Стыковка привычек: привязывайте новые действия к уже существующим ритуалам",
  "Визуальное отслеживание привычек повышает последовательность на 40%",
  "Один пропущенный день не разрушает привычку, два — запускают новый паттерн",
  "Вознаграждайте себя сразу после выполнения, чтобы закрепить цикл",
]

export function ResultState({ url, onReset }: ResultStateProps) {
  function handleCopy() {
    const text = `# ${MOCK_VIDEO.title}\n\n## Summary\n\n${MOCK_SUMMARY}\n\n## Key Points\n\n${MOCK_KEY_POINTS.map((p) => `- ${p}`).join("\n")}`
    navigator.clipboard.writeText(text)
    toast.success("Скопировано в буфер обмена")
  }

  function handleDownload() {
    const text = `# ${MOCK_VIDEO.title}\n\n**Канал:** ${MOCK_VIDEO.channel}\n**Длительность:** ${MOCK_VIDEO.duration}\n**Источник:** ${url}\n\n## Краткое содержание\n\n${MOCK_SUMMARY}\n\n## Ключевые тезисы\n\n${MOCK_KEY_POINTS.map((p) => `- ${p}`).join("\n")}\n\n---\n*Создано YouTube Summarizer*`
    const blob = new Blob([text], { type: "text/markdown" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = "summary.md"
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="flex flex-col gap-6 px-4 py-10 md:py-16">
      {/* Video card */}
      <Card className="overflow-hidden border-border bg-card shadow-sm">
        <CardContent className="flex flex-col gap-4 p-0 md:flex-row">
          <div className="relative aspect-video w-full bg-muted md:w-72 md:min-w-[288px]">
            <div className="flex h-full items-center justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-foreground/10">
                <Play className="h-5 w-5 text-foreground/50" />
              </div>
            </div>
          </div>
          <div className="flex flex-1 flex-col justify-center gap-2 p-4 md:py-5 md:pr-6 md:pl-2">
            <h2 className="text-lg font-semibold leading-snug text-foreground md:text-xl">
              {MOCK_VIDEO.title}
            </h2>
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" />
                {MOCK_VIDEO.channel}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                {MOCK_VIDEO.duration}
              </span>
            </div>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex w-fit items-center gap-1.5 text-sm font-medium text-accent-foreground transition-colors hover:text-accent-foreground/80"
            >
              Открыть на YouTube
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Action bar */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          onClick={handleCopy}
          className="rounded-xl border-border bg-transparent"
        >
          <Copy className="h-4 w-4" />
          Копировать
        </Button>
        <Button
          variant="outline"
          onClick={handleDownload}
          className="rounded-xl border-border bg-transparent"
        >
          <Download className="h-4 w-4" />
          Скачать .md
        </Button>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                className="rounded-xl border-border bg-transparent"
                disabled
              >
                <Share2 className="h-4 w-4" />
                Поделиться
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Скоро</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <div className="ml-auto">
          <Button
            variant="ghost"
            onClick={onReset}
            className="rounded-xl text-muted-foreground hover:text-foreground"
          >
            Другое видео
          </Button>
        </div>
      </div>

      {/* Summary */}
      <Card className="border-border bg-card shadow-sm">
        <CardContent className="flex flex-col gap-4 p-6 md:p-8">
          <h2 className="text-xl font-semibold text-foreground">Краткое содержание</h2>
          <div className="flex flex-col gap-4 text-base leading-relaxed text-foreground/90">
            {MOCK_SUMMARY.split("\n\n").map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Key Points */}
      <Card className="border-border bg-card shadow-sm">
        <CardContent className="flex flex-col gap-4 p-6 md:p-8">
          <h2 className="text-xl font-semibold text-foreground">Ключевые тезисы</h2>
          <ul className="flex flex-col gap-2.5">
            {MOCK_KEY_POINTS.map((point, i) => (
              <li
                key={i}
                className="flex items-start gap-3 text-base leading-relaxed text-foreground/90"
              >
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                {point}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Footer note */}
      <p className="text-center text-xs text-muted-foreground">
        Качество зависит от наличия субтитров и чёткости звука.
      </p>
    </div>
  )
}
