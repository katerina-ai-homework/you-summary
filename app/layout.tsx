import React from "react"
import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"

import "./globals.css"

const _inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "YouTube Summarizer — краткое содержание любого видео",
  description:
    "Вставьте ссылку на YouTube и получите краткое содержание и ключевые тезисы.",
}

export const viewport: Viewport = {
  themeColor: "#F7F9FA",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  )
}
