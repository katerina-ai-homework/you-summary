// Unit tests for validation utilities

import { describe, it, expect } from 'vitest';
import {
  validateYouTubeUrl,
  validateTitle,
  validateCreateSummaryRequest,
  validateGeminiResponse,
  sanitizeErrorMessage,
  normalizeErrorCode,
} from '@/lib/validate';

describe('validateYouTubeUrl', () => {
  it('should accept valid YouTube URLs', () => {
    expect(validateYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true);
    expect(validateYouTubeUrl('https://youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true);
    expect(validateYouTubeUrl('https://m.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true);
    expect(validateYouTubeUrl('https://youtu.be/dQw4w9WgXcQ')).toBe(true);
    expect(validateYouTubeUrl('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe(true);
    expect(validateYouTubeUrl('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe(true);
  });

  it('should reject non-HTTPS URLs', () => {
    expect(validateYouTubeUrl('http://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(false);
  });

  it('should reject non-YouTube URLs', () => {
    expect(validateYouTubeUrl('https://vimeo.com/123456')).toBe(false);
    expect(validateYouTubeUrl('https://example.com')).toBe(false);
  });

  it('should reject IP addresses', () => {
    expect(validateYouTubeUrl('https://127.0.0.1')).toBe(false);
    expect(validateYouTubeUrl('https://192.168.1.1')).toBe(false);
    expect(validateYouTubeUrl('https://10.0.0.1')).toBe(false);
  });

  it('should reject invalid URLs', () => {
    expect(validateYouTubeUrl('not-a-url')).toBe(false);
    expect(validateYouTubeUrl('')).toBe(false);
  });
});

describe('validateTitle', () => {
  it('should accept valid titles', () => {
    expect(validateTitle('Valid Title')).toBe(true);
    expect(validateTitle('A')).toBe(true);
    expect(validateTitle('x'.repeat(120))).toBe(true);
  });

  it('should reject titles with HTML tags', () => {
    expect(validateTitle('<script>alert("xss")</script>')).toBe(false);
    expect(validateTitle('Title <b>bold</b>')).toBe(false);
    expect(validateTitle('Title <div>div</div>')).toBe(false);
  });

  it('should reject titles that are too short', () => {
    expect(validateTitle('')).toBe(false);
  });

  it('should reject titles that are too long', () => {
    expect(validateTitle('x'.repeat(121))).toBe(false);
  });
});

describe('validateCreateSummaryRequest', () => {
  it('should accept valid requests', () => {
    const result = validateCreateSummaryRequest({
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      lang: 'en',
      options: {
        length: 'standard',
        format: 'bullets',
        transcriptMode: 'auto',
      },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.url).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      expect(result.data.lang).toBe('en');
    }
  });

  it('should accept requests with minimal data', () => {
    const result = validateCreateSummaryRequest({
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.url).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      expect(result.data.lang).toBe('auto');
    }
  });

  it('should reject invalid URLs', () => {
    const result = validateCreateSummaryRequest({
      url: 'https://example.com',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('Invalid YouTube URL');
    }
  });

  it('should reject invalid language', () => {
    const result = validateCreateSummaryRequest({
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      lang: 'fr' as any,
    });

    expect(result.success).toBe(false);
  });

  it('should reject invalid options', () => {
    const result = validateCreateSummaryRequest({
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      options: {
        length: 'invalid' as any,
      },
    });

    expect(result.success).toBe(false);
  });
});

describe('validateGeminiResponse', () => {
  it('should accept valid Gemini responses', () => {
    const result = validateGeminiResponse({
      summary: 'This is a summary',
      keyPoints: ['Point 1', 'Point 2', 'Point 3', 'Point 4', 'Point 5'],
      confidence: 85,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.summary).toBe('This is a summary');
      expect(result.data.keyPoints).toHaveLength(5);
      expect(result.data.confidence).toBe(85);
    }
  });

  it('should reject responses with too few key points', () => {
    const result = validateGeminiResponse({
      summary: 'This is a summary',
      keyPoints: ['Point 1', 'Point 2', 'Point 3', 'Point 4'],
      confidence: 85,
    });

    expect(result.success).toBe(false);
  });

  it('should reject responses with too many key points', () => {
    const result = validateGeminiResponse({
      summary: 'This is a summary',
      keyPoints: ['Point 1', 'Point 2', 'Point 3', 'Point 4', 'Point 5', 'Point 6', 'Point 7', 'Point 8', 'Point 9', 'Point 10'],
      confidence: 85,
    });

    expect(result.success).toBe(false);
  });

  it('should reject responses with invalid confidence', () => {
    const result = validateGeminiResponse({
      summary: 'This is a summary',
      keyPoints: ['Point 1', 'Point 2', 'Point 3', 'Point 4', 'Point 5'],
      confidence: 150,
    });

    expect(result.success).toBe(false);
  });
});

describe('sanitizeErrorMessage', () => {
  it('should remove API keys', () => {
    const message = 'Error with API key: sk-1234567890abcdef';
    const sanitized = sanitizeErrorMessage(message);
    expect(sanitized).not.toContain('sk-1234567890abcdef');
    expect(sanitized).toContain('API_KEY');
  });

  it('should remove URLs', () => {
    const message = 'Error at https://api.example.com/endpoint';
    const sanitized = sanitizeErrorMessage(message);
    expect(sanitized).not.toContain('https://api.example.com/endpoint');
    expect(sanitized).toContain('[URL]');
  });

  it('should preserve other content', () => {
    const message = 'Invalid request parameters';
    const sanitized = sanitizeErrorMessage(message);
    expect(sanitized).toBe('Invalid request parameters');
  });
});

describe('normalizeErrorCode', () => {
  it('should normalize Supadata error codes', () => {
    expect(normalizeErrorCode('invalid_request', 'supadata')).toBe('SUPADATA_INVALID_REQUEST');
    expect(normalizeErrorCode('video_unavailable', 'supadata')).toBe('SUPADATA_VIDEO_UNAVAILABLE');
  });

  it('should normalize Gemini error codes', () => {
    expect(normalizeErrorCode('auth', 'gemini')).toBe('GEMINI_AUTH');
    expect(normalizeErrorCode('quota', 'gemini')).toBe('GEMINI_QUOTA');
  });

  it('should normalize backend error codes', () => {
    expect(normalizeErrorCode('internal_error', 'backend')).toBe('BACKEND_INTERNAL_ERROR');
  });

  it('should handle special characters', () => {
    expect(normalizeErrorCode('invalid-request', 'supadata')).toBe('SUPADATA_INVALID_REQUEST');
    expect(normalizeErrorCode('invalid request', 'supadata')).toBe('SUPADATA_INVALID_REQUEST');
  });
});
