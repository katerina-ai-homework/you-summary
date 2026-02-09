// Configuration for YouTube Summarizer backend

export const config = {
  // Supadata
  supadata: {
    apiKey: process.env.SUPADATA_API_KEY || '',
    baseUrl: 'https://api.supadata.ai/v1',
  },

  // Gemini
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite',
  },

  // Vercel KV / Upstash
  kv: {
    restUrl: process.env.KV_REST_API_URL || '',
    restToken: process.env.KV_REST_API_TOKEN || '',
    // Use local storage if KV is not configured
    useLocal: !process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN,
  },

  // Rate limiting
  rateLimit: {
    enabled: process.env.RATE_LIMIT_ENABLED === 'true',
    postRpm: parseInt(process.env.RATE_LIMIT_POST_RPM || '10', 10),
    getRpm: parseInt(process.env.RATE_LIMIT_GET_RPM || '60', 10),
  },

  // TTL settings
  ttl: {
    job: parseInt(process.env.JOB_TTL_SECONDS || '7200', 10), // 2 hours
    cache: parseInt(process.env.CACHE_TTL_SECONDS || '604800', 10), // 7 days
  },

  // Transcript settings
  transcript: {
    maxChars: parseInt(process.env.MAX_TRANSCRIPT_CHARS || '120000', 10),
    chunkMinChars: 12000,
    chunkMaxChars: 18000,
  },

  // Summary length limits (characters)
  summaryLength: {
    short: { min: 600, max: 1200 },
    standard: { min: 1200, max: 2200 },
    detailed: { min: 2200, max: 4000 },
  },

  // Key points limits
  keyPoints: {
    min: 5,
    max: 9,
  },

  // Confidence range
  confidence: {
    min: 0,
    max: 100,
  },

  // URL validation
  url: {
    allowedHosts: ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'] as const,
    allowedProtocols: ['https:'] as const,
  },

  // Title validation
  title: {
    minLength: 1,
    maxLength: 120,
  },
} as const;

// Validate required environment variables
export function validateConfig(): void {
  const errors: string[] = [];

  if (!config.supadata.apiKey) {
    errors.push('SUPADATA_API_KEY is required');
  }

  if (!config.gemini.apiKey) {
    errors.push('GEMINI_API_KEY is required');
  }

  // KV is optional for local development
  if (!config.kv.useLocal && (!config.kv.restUrl || !config.kv.restToken)) {
    errors.push('KV_REST_API_URL and KV_REST_API_TOKEN are required (or leave empty for local mode)');
  }

  if (errors.length > 0) {
    throw new Error(`Missing required environment variables:\n${errors.join('\n')}`);
  }
}

// Get config for public use (without secrets)
export function getPublicConfig() {
  return {
    geminiModel: config.gemini.model,
    rateLimitEnabled: config.rateLimit.enabled,
    rateLimitPostRpm: config.rateLimit.postRpm,
    rateLimitGetRpm: config.rateLimit.getRpm,
    jobTtl: config.ttl.job,
    cacheTtl: config.ttl.cache,
    maxTranscriptChars: config.transcript.maxChars,
    useLocalStorage: config.kv.useLocal,
  };
}
