// Core types for YouTube Summarizer backend

export type JobStatus = 'processing' | 'completed' | 'failed' | 'cancelled';
export type JobStage = 'transcript' | 'summarize';
export type TranscriptMode = 'native' | 'auto' | 'generate';
export type SummaryLength = 'short' | 'standard' | 'detailed';
export type SummaryFormat = 'bullets' | 'paragraph';
export type Language = 'auto' | 'en' | 'ru';
export type ErrorProvider = 'supadata' | 'gemini' | 'backend';

export interface JobInput {
  title?: string;
  url: string;
  lang?: Language;
  options?: {
    length?: SummaryLength;
    format?: SummaryFormat;
    transcriptMode?: TranscriptMode;
  };
}

export interface SupadataInfo {
  mode: string;
  jobId?: string;
  transcriptLang?: string;
  availableLangs?: string[];
}

export interface SummaryResult {
  summary: string;
  keyPoints: string[];
  confidence: number;
  model: string;
}

export interface JobError {
  code: string;
  message: string;
  provider?: ErrorProvider;
}

export interface Job {
  id: string;
  status: JobStatus;
  stage: JobStage;
  createdAt: string;
  updatedAt: string;
  input: JobInput;
  supadata: SupadataInfo;
  result?: SummaryResult;
  error?: JobError;
}

export interface CreateSummaryRequest {
  title?: string;
  url: string;
  lang?: Language;
  options?: {
    length?: SummaryLength;
    format?: SummaryFormat;
    transcriptMode?: TranscriptMode;
  };
}

export interface CreateSummaryResponse {
  jobId: string;
  status: JobStatus;
  stage: JobStage;
}

export interface GetSummaryResponse {
  jobId: string;
  status: JobStatus;
  stage?: JobStage;
  providerStatus?: string;
  result?: SummaryResult;
  meta?: {
    transcriptLang?: string;
    availableLangs?: string[];
  };
  error?: JobError;
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

// Supadata API types
export interface SupadataTranscriptRequest {
  url: string;
  lang?: string;
  text: boolean;
  mode?: TranscriptMode;
}

export interface SupadataTranscriptResponse {
  content: string;
  lang?: string;
  availableLangs?: string[];
}

export interface SupadataJobResponse {
  jobId: string;
  status: 'queued' | 'active' | 'completed' | 'failed';
  content?: string;
  lang?: string;
  availableLangs?: string[];
}

export interface SupadataErrorResponse {
  error: string;
  code?: string;
}

// Gemini API types
export interface GeminiSummaryRequest {
  transcript: string;
  options: {
    length: SummaryLength;
    format: SummaryFormat;
  };
}

export interface GeminiSummaryResponse {
  summary: string;
  keyPoints: string[];
  confidence: number;
}

// Rate limit types
export interface RateLimitConfig {
  enabled: boolean;
  postRpm: number;
  getRpm: number;
}

// Cache types
export interface CacheEntry {
  result: SummaryResult;
  meta: {
    transcriptLang?: string;
    availableLangs?: string[];
  };
  createdAt: string;
}
