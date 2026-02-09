import { SiteHeader } from "@/components/site-header"
import { YouTubeSummarizer } from "@/components/youtube-summarizer"
import { Toaster } from "@/components/ui/sonner"

export default function Page() {
  return (
    <>
      <SiteHeader />
      <YouTubeSummarizer />
      <Toaster position="bottom-center" />
    </>
  )
}
