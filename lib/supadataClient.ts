// Supadata API client for transcript retrieval

import { config } from './config';
import type {
  SupadataTranscriptRequest,
  SupadataTranscriptResponse,
  SupadataJobResponse,
  SupadataErrorResponse,
} from './types';

export class SupadataError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'SupadataError';
  }
}

// Get transcript from Supadata
export async function getTranscript(
  request: SupadataTranscriptRequest,
): Promise<{ content?: string; lang?: string; availableLangs?: string[]; jobId?: string }> {
  const { url, lang, text, mode } = request;

  // Build query parameters
  const params = new URLSearchParams({
    url,
    text: text.toString(),
  });

  if (lang) {
    params.append('lang', lang);
  }

  if (mode) {
    params.append('mode', mode);
  }

  const apiUrl = `${config.supadata.baseUrl}/transcript?${params.toString()}`;

  try {
    console.log('[DEBUG] Supadata API request:', apiUrl)

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'x-api-key': config.supadata.apiKey,
        'Content-Type': 'application/json',
      },
    });

    console.log('[DEBUG] Supadata API response status:', response.status)

    const data = await response.json();
    console.log('[DEBUG] Supadata API response data:', JSON.stringify(data).substring(0, 500))

    // Handle 202 Accepted - async job
    if (response.status === 202) {
      if (data.jobId) {
        return { jobId: data.jobId };
      }
      throw new SupadataError(
        'No jobId returned for async transcript',
        'NO_JOB_ID',
        response.status,
      );
    }

    // Handle 200 OK - transcript ready
    if (response.status === 200) {
      if (data.content) {
        return {
          content: data.content,
          lang: data.lang,
          availableLangs: data.availableLangs,
        };
      }
      throw new SupadataError(
        'No content in transcript response',
        'NO_CONTENT',
        response.status,
      );
    }

    // Handle errors
    if (response.status === 400) {
      throw new SupadataError(
        'Invalid URL or parameters',
        'INVALID_REQUEST',
        response.status,
      );
    }

    if (response.status === 403 || response.status === 404) {
      throw new SupadataError(
        'Video unavailable or restricted',
        'VIDEO_UNAVAILABLE',
        response.status,
      );
    }

    if (response.status === 206) {
      console.log('[DEBUG] Supadata returned 206 - checking for available languages')
      // 206 might contain available languages
      if (data.availableLangs && Array.isArray(data.availableLangs) && data.availableLangs.length > 0) {
        console.log('[DEBUG] Available languages:', data.availableLangs)
        // Try to get transcript with first available language
        const firstLang = data.availableLangs[0]
        console.log('[DEBUG] Trying with language:', firstLang)
        // Return jobId to retry with specific language
        throw new SupadataError(
          `Transcript available in languages: ${data.availableLangs.join(', ')}. Please specify language.`,
          'TRANSCRIPT_UNAVAILABLE',
          response.status,
        )
      }
      throw new SupadataError(
        'Transcript unavailable for this video',
        'TRANSCRIPT_UNAVAILABLE',
        response.status,
      );
    }

    // Generic error
    throw new SupadataError(
      data.error || 'Unknown error from Supadata',
      data.code || 'UNKNOWN_ERROR',
      response.status,
    );
  } catch (error) {
    if (error instanceof SupadataError) {
      throw error;
    }

    // Network or other errors
    throw new SupadataError(
      'Failed to connect to Supadata API',
      'NETWORK_ERROR',
      500,
    );
  }
}

// Get transcript job status
export async function getTranscriptJob(
  jobId: string,
): Promise<{ status: string; content?: string; lang?: string; availableLangs?: string[] }> {
  const apiUrl = `${config.supadata.baseUrl}/transcript/${jobId}`;

  try {
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'x-api-key': config.supadata.apiKey,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (response.status === 200) {
      return {
        status: data.status,
        content: data.content,
        lang: data.lang,
        availableLangs: data.availableLangs,
      };
    }

    if (response.status === 404) {
      throw new SupadataError(
        'Job not found',
        'JOB_NOT_FOUND',
        response.status,
      );
    }

    throw new SupadataError(
      data.error || 'Unknown error from Supadata',
      data.code || 'UNKNOWN_ERROR',
      response.status,
    );
  } catch (error) {
    if (error instanceof SupadataError) {
      throw error;
    }

    throw new SupadataError(
      'Failed to connect to Supadata API',
      'NETWORK_ERROR',
      500,
    );
  }
}

// Get video title from YouTube oEmbed API
export async function getVideoTitle(url: string): Promise<string | null> {
  try {
    // Extract video ID from URL
    const videoId = extractVideoId(url);
    if (!videoId) {
      return null;
    }

    // Use YouTube oEmbed API to get video info
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    const response = await fetch(oembedUrl);

    if (response.ok) {
      const data = await response.json();
      return data.title || null;
    }

    return null;
  } catch {
    return null;
  }
}

// Extract video ID from YouTube URL
function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

// Map Supadata error codes to normalized codes
export function mapSupadataError(error: SupadataError): string {
  const errorMap: Record<string, string> = {
    INVALID_REQUEST: 'SUPADATA_INVALID_REQUEST',
    VIDEO_UNAVAILABLE: 'VIDEO_UNAVAILABLE',
    TRANSCRIPT_UNAVAILABLE: 'TRANSCRIPT_UNAVAILABLE',
    NO_JOB_ID: 'SUPADATA_UPSTREAM_ERROR',
    JOB_NOT_FOUND: 'SUPADATA_UPSTREAM_ERROR',
    NETWORK_ERROR: 'SUPADATA_UPSTREAM_ERROR',
    UNKNOWN_ERROR: 'SUPADATA_UPSTREAM_ERROR',
  };

  return errorMap[error.code] || 'SUPADATA_UPSTREAM_ERROR';
}
