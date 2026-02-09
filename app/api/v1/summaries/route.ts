// POST /api/v1/summaries - Create a new summary job

import { NextRequest, NextResponse } from 'next/server';
import { validateCreateSummaryRequest } from '@/lib/validate';
import { createJob, checkCache } from '@/lib/summarizeService';
import { checkPostRateLimit, getClientIp, rateLimitErrorResponse } from '@/lib/rateLimit';
import { validateConfig } from '@/lib/config';

export async function POST(request: NextRequest) {
  try {
    // Validate config
    try {
      validateConfig();
    } catch (error) {
      return NextResponse.json(
        {
          error: {
            code: 'CONFIGURATION_ERROR',
            message: 'Server configuration error',
          },
        },
        { status: 500 },
      );
    }

    // Check rate limit
    const clientIp = getClientIp(request);
    const rateLimitResult = await checkPostRateLimit(clientIp);

    if (!rateLimitResult.success) {
      return rateLimitErrorResponse(rateLimitResult.limit, rateLimitResult.reset);
    }

    // Parse request body
    const body = await request.json();

    // Validate request
    const validation = validateCreateSummaryRequest(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_REQUEST',
            message: 'Invalid request parameters',
            details: { errors: validation.error },
          },
        },
        { status: 400 },
      );
    }

    const { url, title, lang, options } = validation.data;

    // Check cache first
    const cached = await checkCache(url, options);

    if (cached) {
      // Return cached result as a completed job
      return NextResponse.json(
        {
          jobId: 'cached',
          status: 'completed',
          result: cached.result,
          meta: cached.meta,
        },
        { status: 200 },
      );
    }

    // Create new job
    const job = await createJob({
      title,
      url,
      lang,
      options,
    });

    // Return job ID
    return NextResponse.json(
      {
        jobId: job.id,
        status: job.status,
        stage: job.stage,
      },
      {
        status: 202,
        headers: {
          'X-RateLimit-Limit': rateLimitResult.limit.toString(),
          'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
          'X-RateLimit-Reset': new Date(rateLimitResult.reset).toISOString(),
        },
      },
    );
  } catch (error) {
    // Handle unexpected errors
    console.error('Error in POST /api/v1/summaries:', error);

    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
        },
      },
      { status: 500 },
    );
  }
}
