// Integration tests for API endpoints

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/v1/summaries/route';
import { GET, DELETE } from '@/app/api/v1/summaries/[jobId]/route';
import { createJob, getJob, cancelJob } from '@/lib/summarizeService';
import { checkPostRateLimit, checkGetRateLimit } from '@/lib/rateLimit';

// Mock dependencies
vi.mock('@/lib/summarizeService');
vi.mock('@/lib/rateLimit');

describe('POST /api/v1/summaries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a new job', async () => {
    const mockJob = {
      id: 'test-job-id',
      status: 'processing' as const,
      stage: 'transcript' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      input: {
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      },
      supadata: {
        mode: 'auto',
      },
    };

    vi.mocked(createJob).mockResolvedValue(mockJob);
    vi.mocked(checkPostRateLimit).mockResolvedValue({
      success: true,
      limit: 10,
      remaining: 9,
      reset: Date.now() + 60000,
    });

    const request = new NextRequest('http://localhost/api/v1/summaries', {
      method: 'POST',
      body: JSON.stringify({
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(202);
    expect(data.jobId).toBe('test-job-id');
    expect(data.status).toBe('processing');
    expect(data.stage).toBe('transcript');
  });

  it('should return 400 for invalid URL', async () => {
    const request = new NextRequest('http://localhost/api/v1/summaries', {
      method: 'POST',
      body: JSON.stringify({
        url: 'https://example.com',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe('INVALID_REQUEST');
  });

  it('should return 429 when rate limited', async () => {
    vi.mocked(checkPostRateLimit).mockResolvedValue({
      success: false,
      limit: 10,
      remaining: 0,
      reset: Date.now() + 60000,
    });

    const request = new NextRequest('http://localhost/api/v1/summaries', {
      method: 'POST',
      body: JSON.stringify({
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(429);
  });
});

describe('GET /api/v1/summaries/[jobId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return job status when processing', async () => {
    const mockJob = {
      id: 'test-job-id',
      status: 'processing' as const,
      stage: 'transcript' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      input: {
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      },
      supadata: {
        mode: 'auto',
      },
    };

    vi.mocked(getJob).mockResolvedValue(mockJob);
    vi.mocked(checkGetRateLimit).mockResolvedValue({
      success: true,
      limit: 60,
      remaining: 59,
      reset: Date.now() + 60000,
    });

    const request = new NextRequest('http://localhost/api/v1/summaries/test-job-id');
    const response = await GET(request, { params: Promise.resolve({ jobId: 'test-job-id' }) });
    const data = await response.json();

    expect(response.status).toBe(202);
    expect(data.jobId).toBe('test-job-id');
    expect(data.status).toBe('processing');
  });

  it('should return 404 when job not found', async () => {
    vi.mocked(getJob).mockResolvedValue(null);
    vi.mocked(checkGetRateLimit).mockResolvedValue({
      success: true,
      limit: 60,
      remaining: 59,
      reset: Date.now() + 60000,
    });

    const request = new NextRequest('http://localhost/api/v1/summaries/test-job-id');
    const response = await GET(request, { params: Promise.resolve({ jobId: 'test-job-id' }) });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error.code).toBe('JOB_NOT_FOUND');
  });

  it('should return 410 when job is cancelled', async () => {
    const mockJob = {
      id: 'test-job-id',
      status: 'cancelled' as const,
      stage: 'transcript' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      input: {
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      },
      supadata: {
        mode: 'auto',
      },
    };

    vi.mocked(getJob).mockResolvedValue(mockJob);
    vi.mocked(checkGetRateLimit).mockResolvedValue({
      success: true,
      limit: 60,
      remaining: 59,
      reset: Date.now() + 60000,
    });

    const request = new NextRequest('http://localhost/api/v1/summaries/test-job-id');
    const response = await GET(request, { params: Promise.resolve({ jobId: 'test-job-id' }) });
    const data = await response.json();

    expect(response.status).toBe(410);
    expect(data.error.code).toBe('JOB_CANCELLED');
  });
});

describe('DELETE /api/v1/summaries/[jobId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should cancel job', async () => {
    vi.mocked(cancelJob).mockResolvedValue(true);

    const request = new NextRequest('http://localhost/api/v1/summaries/test-job-id', {
      method: 'DELETE',
    });
    const response = await DELETE(request, { params: Promise.resolve({ jobId: 'test-job-id' }) });

    expect(response.status).toBe(204);
    expect(cancelJob).toHaveBeenCalledWith('test-job-id');
  });

  it('should return 404 when job not found', async () => {
    vi.mocked(cancelJob).mockResolvedValue(false);

    const request = new NextRequest('http://localhost/api/v1/summaries/test-job-id', {
      method: 'DELETE',
    });
    const response = await DELETE(request, { params: Promise.resolve({ jobId: 'test-job-id' }) });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error.code).toBe('JOB_NOT_FOUND');
  });
});
