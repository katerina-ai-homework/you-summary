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
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'x-api-key': config.supadata.apiKey,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

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
