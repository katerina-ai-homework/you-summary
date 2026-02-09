// Gemini API client for summarization

import { google } from '@ai-sdk/google';
import { generateText } from 'ai';
import { config } from './config';
import type {
  GeminiSummaryRequest,
  GeminiSummaryResponse,
  SummaryLength,
  SummaryFormat,
} from './types';
import { validateGeminiResponse } from './validate';

export class GeminiError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'GeminiError';
  }
}

// Build prompt for Gemini
function buildPrompt(
  transcript: string,
  length: SummaryLength,
  format: SummaryFormat,
): string {
  const lengthInstructions: Record<SummaryLength, string> = {
    short: '600-1200 characters',
    standard: '1200-2200 characters',
    detailed: '2200-4000 characters',
  };

  const formatInstructions: Record<SummaryFormat, string> = {
    bullets: 'Use bullet points for key information',
    paragraph: 'Use paragraph format with clear structure',
  };

  return `You are a professional video summarizer. Your task is to create a concise and accurate summary of the provided YouTube video transcript.

Requirements:
1. Summary length: ${lengthInstructions[length]}
2. Format: ${formatInstructions[format]}
3. Extract 5-9 key points
4. Provide a confidence score (0-100) based on how well you understood the content
5. Return ONLY valid JSON, no markdown formatting, no prefixes

JSON Schema:
{
  "summary": "string (main summary)",
  "keyPoints": ["string", "string", ...],
  "confidence": number (0-100)
}

Transcript:
${transcript}`;
}

// Chunk transcript if too long
function chunkTranscript(transcript: string): string[] {
  const { maxChars, chunkMinChars, chunkMaxChars } = config.transcript;

  if (transcript.length <= maxChars) {
    return [transcript];
  }

  const chunks: string[] = [];
  let currentChunk = '';
  const sentences = transcript.split(/(?<=[.!?])\s+/);

  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length > chunkMaxChars && currentChunk.length >= chunkMinChars) {
      chunks.push(currentChunk.trim());
      currentChunk = sentence;
    } else {
      currentChunk += (currentChunk ? ' ' : '') + sentence;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

// Summarize transcript using Gemini
export async function summarizeTranscript(
  request: GeminiSummaryRequest,
): Promise<GeminiSummaryResponse> {
  const { transcript, options } = request;

  try {
    // Check if transcript needs chunking
    const chunks = chunkTranscript(transcript);

    if (chunks.length === 1) {
      // Single chunk - summarize directly
      return await summarizeChunk(chunks[0], options.length, options.format);
    }

    // Multiple chunks - summarize each chunk then aggregate
    const chunkSummaries: string[] = [];

    for (const chunk of chunks) {
      const summary = await summarizeChunk(chunk, 'standard', 'paragraph');
      chunkSummaries.push(summary.summary);
    }

    // Aggregate chunk summaries
    const aggregatedTranscript = chunkSummaries.join('\n\n');
    return await summarizeChunk(aggregatedTranscript, options.length, options.format);
  } catch (error) {
    if (error instanceof GeminiError) {
      throw error;
    }

    throw new GeminiError(
      'Failed to summarize transcript',
      'UNKNOWN_ERROR',
      500,
    );
  }
}

// Summarize a single chunk
async function summarizeChunk(
  chunk: string,
  length: SummaryLength,
  format: SummaryFormat,
): Promise<GeminiSummaryResponse> {
  const prompt = buildPrompt(chunk, length, format);

  try {
    const result = await generateText({
      model: google(config.gemini.model),
      prompt,
      temperature: 0.3,
    });

    // Parse JSON response
    let jsonText = result.text.trim();

    // Remove markdown code blocks if present
    jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');

    let parsed;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      throw new GeminiError(
        'Failed to parse Gemini response as JSON',
        'INVALID_JSON',
        500,
      );
    }

    // Validate response structure
    const validation = validateGeminiResponse(parsed);
    if (!validation.success) {
      throw new GeminiError(
        `Invalid Gemini response: ${validation.error}`,
        'INVALID_RESPONSE',
        500,
      );
    }

    return validation.data;
  } catch (error) {
    if (error instanceof GeminiError) {
      throw error;
    }

    // Handle API errors
    if (error instanceof Error) {
      const errorMessage = error.message.toLowerCase();

      if (errorMessage.includes('auth') || errorMessage.includes('unauthorized')) {
        throw new GeminiError(
          'Authentication failed with Gemini API',
          'AUTH',
          401,
        );
      }

      if (errorMessage.includes('quota') || errorMessage.includes('limit')) {
        throw new GeminiError(
          'Quota exceeded for Gemini API',
          'QUOTA',
          429,
        );
      }

      if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
        throw new GeminiError(
          'Network error connecting to Gemini API',
          'NETWORK_ERROR',
          500,
        );
      }
    }

    throw new GeminiError(
      'Unknown error from Gemini API',
      'UNKNOWN_ERROR',
      500,
    );
  }
}

// Map Gemini error codes to normalized codes
export function mapGeminiError(error: GeminiError): string {
  const errorMap: Record<string, string> = {
    AUTH: 'GEMINI_AUTH',
    QUOTA: 'GEMINI_QUOTA',
    NETWORK_ERROR: 'GEMINI_UPSTREAM_ERROR',
    INVALID_JSON: 'GEMINI_INVALID_RESPONSE',
    INVALID_RESPONSE: 'GEMINI_INVALID_RESPONSE',
    UNKNOWN_ERROR: 'GEMINI_UPSTREAM_ERROR',
  };

  return errorMap[error.code] || 'GEMINI_UPSTREAM_ERROR';
}
