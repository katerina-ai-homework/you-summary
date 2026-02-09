// Unit tests for job store

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Redis } from '@upstash/redis';
import {
  saveJob,
  getJob,
  deleteJob,
  updateJob,
  saveToCache,
  getFromCache,
  deleteFromCache,
  generateCacheKey,
} from '@/lib/jobStore';
import type { Job } from '@/lib/types';

// Mock Redis
vi.mock('@upstash/redis', () => ({
  Redis: vi.fn(),
}));

describe('generateCacheKey', () => {
  it('should generate consistent cache keys for same input', () => {
    const key1 = generateCacheKey('https://youtube.com/watch?v=123');
    const key2 = generateCacheKey('https://youtube.com/watch?v=123');
    expect(key1).toBe(key2);
  });

  it('should generate different cache keys for different URLs', () => {
    const key1 = generateCacheKey('https://youtube.com/watch?v=123');
    const key2 = generateCacheKey('https://youtube.com/watch?v=456');
    expect(key1).not.toBe(key2);
  });

  it('should generate different cache keys for different options', () => {
    const key1 = generateCacheKey('https://youtube.com/watch?v=123', { length: 'short' });
    const key2 = generateCacheKey('https://youtube.com/watch?v=123', { length: 'detailed' });
    expect(key1).not.toBe(key2);
  });

  it('should prefix cache keys with "cache:"', () => {
    const key = generateCacheKey('https://youtube.com/watch?v=123');
    expect(key).toMatch(/^cache:/);
  });
});

describe('Job Store Operations', () => {
  let mockRedis: any;

  beforeEach(() => {
    mockRedis = {
      set: vi.fn().mockResolvedValue('OK'),
      get: vi.fn(),
      del: vi.fn().mockResolvedValue(1),
    };
    vi.mocked(Redis).mockReturnValue(mockRedis);
  });

  describe('saveJob', () => {
    it('should save job to Redis with TTL', async () => {
      const job: Job = {
        id: 'test-job-id',
        status: 'processing',
        stage: 'transcript',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        input: {
          url: 'https://youtube.com/watch?v=123',
        },
        supadata: {
          mode: 'auto',
        },
      };

      await saveJob(job);

      expect(mockRedis.set).toHaveBeenCalledWith(
        'job:test-job-id',
        JSON.stringify(job),
        { ex: 7200 },
      );
    });
  });

  describe('getJob', () => {
    it('should return job when found', async () => {
      const job: Job = {
        id: 'test-job-id',
        status: 'processing',
        stage: 'transcript',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        input: {
          url: 'https://youtube.com/watch?v=123',
        },
        supadata: {
          mode: 'auto',
        },
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(job));

      const result = await getJob('test-job-id');

      expect(result).toEqual(job);
      expect(mockRedis.get).toHaveBeenCalledWith('job:test-job-id');
    });

    it('should return null when job not found', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await getJob('test-job-id');

      expect(result).toBeNull();
    });

    it('should return null when JSON parsing fails', async () => {
      mockRedis.get.mockResolvedValue('invalid json');

      const result = await getJob('test-job-id');

      expect(result).toBeNull();
    });
  });

  describe('deleteJob', () => {
    it('should delete job from Redis', async () => {
      await deleteJob('test-job-id');

      expect(mockRedis.del).toHaveBeenCalledWith('job:test-job-id');
    });
  });

  describe('updateJob', () => {
    it('should update existing job', async () => {
      const existingJob: Job = {
        id: 'test-job-id',
        status: 'processing',
        stage: 'transcript',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        input: {
          url: 'https://youtube.com/watch?v=123',
        },
        supadata: {
          mode: 'auto',
        },
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(existingJob));

      await updateJob('test-job-id', { status: 'completed' });

      expect(mockRedis.set).toHaveBeenCalledWith(
        'job:test-job-id',
        expect.stringContaining('"status":"completed"'),
        { ex: 7200 },
      );
    });

    it('should return null when job not found', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await updateJob('test-job-id', { status: 'completed' });

      expect(result).toBeNull();
    });
  });
});

describe('Cache Operations', () => {
  let mockRedis: any;

  beforeEach(() => {
    mockRedis = {
      set: vi.fn().mockResolvedValue('OK'),
      get: vi.fn(),
      del: vi.fn().mockResolvedValue(1),
    };
    vi.mocked(Redis).mockReturnValue(mockRedis);
  });

  describe('saveToCache', () => {
    it('should save cache entry with TTL', async () => {
      const entry = {
        result: {
          summary: 'Test summary',
          keyPoints: ['Point 1', 'Point 2'],
          confidence: 85,
          model: 'gemini-2.5-flash-lite',
        },
        meta: {
          transcriptLang: 'en',
        },
        createdAt: new Date().toISOString(),
      };

      await saveToCache('https://youtube.com/watch?v=123', { length: 'short' }, entry);

      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.stringMatching(/^cache:/),
        JSON.stringify(entry),
        { ex: 604800 },
      );
    });
  });

  describe('getFromCache', () => {
    it('should return cache entry when found', async () => {
      const entry = {
        result: {
          summary: 'Test summary',
          keyPoints: ['Point 1', 'Point 2'],
          confidence: 85,
          model: 'gemini-2.5-flash-lite',
        },
        meta: {
          transcriptLang: 'en',
        },
        createdAt: new Date().toISOString(),
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(entry));

      const result = await getFromCache('https://youtube.com/watch?v=123', { length: 'short' });

      expect(result).toEqual(entry);
    });

    it('should return null when cache not found', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await getFromCache('https://youtube.com/watch?v=123', { length: 'short' });

      expect(result).toBeNull();
    });
  });

  describe('deleteFromCache', () => {
    it('should delete cache entry', async () => {
      await deleteFromCache('https://youtube.com/watch?v=123', { length: 'short' });

      expect(mockRedis.del).toHaveBeenCalledWith(expect.stringMatching(/^cache:/));
    });
  });
});
