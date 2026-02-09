// Validation utilities using zod

import { z } from 'zod';
import { config } from './config';
import type {
  Language,
  SummaryLength,
  SummaryFormat,
  TranscriptMode,
  CreateSummaryRequest,
} from './types';

// YouTube URL validation regex
const YOUTUBE_URL_REGEX =
  /^https:\/\/(www\.)?(youtube\.com\/(watch\?v=|shorts\/|embed\/)|youtu\.be\/)[a-zA-Z0-9_-]+/;

// Private IP ranges for SSRF protection
const PRIVATE_IP_REGEX = /^(127\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|192\.168\.)/;

// Validate YouTube URL
export function validateYouTubeUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);

    // Check protocol
    if (!config.url.allowedProtocols.includes(parsedUrl.protocol as any)) {
      return false;
    }

    // Check hostname
    const hostname = parsedUrl.hostname.toLowerCase();
    if (!config.url.allowedHosts.includes(hostname as any)) {
      return false;
    }

    // Check for IP addresses
    if (PRIVATE_IP_REGEX.test(hostname)) {
      return false;
    }

    // Check YouTube URL format
    if (!YOUTUBE_URL_REGEX.test(url)) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

// Validate title (no HTML, length constraints)
export function validateTitle(title: string): boolean {
  if (title.length < config.title.minLength || title.length > config.title.maxLength) {
    return false;
  }

  // Check for HTML tags
  const htmlTagRegex = /<[^>]*>/;
  if (htmlTagRegex.test(title)) {
    return false;
  }

  return true;
}

// Zod schema for create summary request
export const createSummarySchema = z.object({
  title: z
    .string()
    .min(config.title.minLength)
    .max(config.title.maxLength)
    .refine(validateTitle, {
      message: 'Title must not contain HTML tags',
    })
    .optional(),
  url: z
    .string()
    .url()
    .refine(validateYouTubeUrl, {
      message: 'Invalid YouTube URL',
    }),
  lang: z.enum(['auto', 'en', 'ru']).default('auto'),
  options: z
    .object({
      length: z.enum(['short', 'standard', 'detailed']).default('standard'),
      format: z.enum(['bullets', 'paragraph']).default('bullets'),
      transcriptMode: z.enum(['native', 'auto', 'generate']).default('auto'),
    })
    .optional(),
});

// Type inference from schema
export type CreateSummarySchema = z.infer<typeof createSummarySchema>;

// Validate create summary request
export function validateCreateSummaryRequest(
  data: unknown,
): { success: true; data: CreateSummaryRequest } | { success: false; error: string } {
  const result = createSummarySchema.safeParse(data);

  if (!result.success) {
    const errors = result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
    return { success: false, error: errors };
  }

  return { success: true, data: result.data };
}

// Validate language
export function validateLanguage(lang: string): lang is Language {
  return ['auto', 'en', 'ru'].includes(lang);
}

// Validate summary length
export function validateSummaryLength(length: string): length is SummaryLength {
  return ['short', 'standard', 'detailed'].includes(length);
}

// Validate summary format
export function validateSummaryFormat(format: string): format is SummaryFormat {
  return ['bullets', 'paragraph'].includes(format);
}

// Validate transcript mode
export function validateTranscriptMode(mode: string): mode is TranscriptMode {
  return ['native', 'auto', 'generate'].includes(mode);
}

// Validate summary content length
export function validateSummaryLengthContent(
  summary: string,
  length: SummaryLength,
): boolean {
  const limits = config.summaryLength[length];
  return summary.length >= limits.min && summary.length <= limits.max;
}

// Validate key points count
export function validateKeyPointsCount(count: number): boolean {
  return count >= config.keyPoints.min && count <= config.keyPoints.max;
}

// Validate confidence
export function validateConfidence(confidence: number): boolean {
  return confidence >= config.confidence.min && confidence <= config.confidence.max;
}

// Validate Gemini response JSON
export const geminiResponseSchema = z.object({
  summary: z.string(),
  keyPoints: z.array(z.string()).min(config.keyPoints.min).max(config.keyPoints.max),
  confidence: z.number().int().min(config.confidence.min).max(config.confidence.max),
});

export type GeminiResponseSchema = z.infer<typeof geminiResponseSchema>;

// Validate Gemini response
export function validateGeminiResponse(
  data: unknown,
): { success: true; data: z.infer<typeof geminiResponseSchema> } | { success: false; error: string } {
  const result = geminiResponseSchema.safeParse(data);

  if (!result.success) {
    const errors = result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
    return { success: false, error: errors };
  }

  return { success: true, data: result.data };
}

// Sanitize error messages (remove sensitive information)
export function sanitizeErrorMessage(message: string): string {
  // Remove API keys
  const sanitized = message.replace(/api[_-]?key[=:]\s*[^\s,}]+/gi, 'API_KEY');
  // Remove URLs with potential sensitive data
  return sanitized.replace(/https?:\/\/[^\s]+/g, '[URL]');
}

// Normalize error codes
export function normalizeErrorCode(code: string, provider: string): string {
  const normalizedCode = code.toUpperCase().replace(/[^A-Z0-9_]/g, '_');

  const providerPrefixes: Record<string, string> = {
    supadata: 'SUPADATA_',
    gemini: 'GEMINI_',
    backend: 'BACKEND_',
  };

  const prefix = providerPrefixes[provider] || '';
  return `${prefix}${normalizedCode}`;
}
