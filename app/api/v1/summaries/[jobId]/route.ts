// GET /api/v1/summaries/[jobId] - Get job status or result
// DELETE /api/v1/summaries/[jobId] - Cancel job

import { NextRequest, NextResponse } from 'next/server';
import { getJob, cancelJob } from '@/lib/summarizeService';
import { processJob } from '@/lib/summarizeService';
import { checkGetRateLimit, getClientIp, rateLimitErrorResponse } from '@/lib/rateLimit';
import { validateConfig } from '@/lib/config';
import { getVideoTitle } from '@/lib/supadataClient';

// GET - Get job status or result
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
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
    const rateLimitResult = await checkGetRateLimit(clientIp);

    if (!rateLimitResult.success) {
      return rateLimitErrorResponse(rateLimitResult.limit, rateLimitResult.reset);
    }

    const { jobId } = await params;

    // Get job
    const job = await getJob(jobId);

    if (!job) {
      return NextResponse.json(
        {
          error: {
            code: 'JOB_NOT_FOUND',
            message: 'Job not found',
          },
        },
        { status: 404 },
      );
    }

    // Check if job is cancelled
    if (job.status === 'cancelled') {
      return NextResponse.json(
        {
          error: {
            code: 'JOB_CANCELLED',
            message: 'Job has been cancelled',
          },
        },
        { status: 410 },
      );
    }

    // If job is completed, return result
    if (job.status === 'completed') {
      // Get video title
      const title = await getVideoTitle(job.input.url);

      return NextResponse.json(
        {
          jobId: job.id,
          status: job.status,
          result: job.result,
          meta: {
            transcriptLang: job.supadata.transcriptLang,
            availableLangs: job.supadata.availableLangs,
            title,
          },
        },
        {
          status: 200,
          headers: {
            'X-RateLimit-Limit': rateLimitResult.limit.toString(),
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': new Date(rateLimitResult.reset).toISOString(),
          },
        },
      );
    }

    // If job is failed, return error
    if (job.status === 'failed') {
      return NextResponse.json(
        {
          jobId: job.id,
          status: job.status,
          error: job.error,
        },
        {
          status: 500,
          headers: {
            'X-RateLimit-Limit': rateLimitResult.limit.toString(),
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': new Date(rateLimitResult.reset).toISOString(),
          },
        },
      );
    }

    // If job is processing, process it and return status
    const updatedJob = await processJob(jobId);

    // Check if job is still processing
    if (updatedJob.status === 'processing') {
      // Determine provider status
      let providerStatus: string | undefined;
      
      if (updatedJob.stage === 'transcript' && updatedJob.supadata.jobId) {
        // We have a Supadata job ID, but we don't know the exact status
        // In a real implementation, you might want to poll Supadata for the exact status
        providerStatus = 'processing';
      }

      return NextResponse.json(
        {
          jobId: updatedJob.id,
          status: updatedJob.status,
          stage: updatedJob.stage,
          providerStatus,
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
    }

    // If job completed during processing
    if (updatedJob.status === 'completed') {
      return NextResponse.json(
        {
          jobId: updatedJob.id,
          status: updatedJob.status,
          result: updatedJob.result,
          meta: {
            transcriptLang: updatedJob.supadata.transcriptLang,
            availableLangs: updatedJob.supadata.availableLangs,
          },
        },
        {
          status: 200,
          headers: {
            'X-RateLimit-Limit': rateLimitResult.limit.toString(),
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': new Date(rateLimitResult.reset).toISOString(),
          },
        },
      );
    }

    // If job failed during processing
    if (updatedJob.status === 'failed') {
      return NextResponse.json(
        {
          jobId: updatedJob.id,
          status: updatedJob.status,
          error: updatedJob.error,
        },
        {
          status: 500,
          headers: {
            'X-RateLimit-Limit': rateLimitResult.limit.toString(),
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': new Date(rateLimitResult.reset).toISOString(),
          },
        },
      );
    }

    // Should not reach here
    return NextResponse.json(
      {
        error: {
          code: 'UNKNOWN_STATE',
          message: 'Job is in an unknown state',
        },
      },
      { status: 500 },
    );
  } catch (error) {
    // Handle unexpected errors
    console.error('Error in GET /api/v1/summaries/[jobId]:', error);

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

// DELETE - Cancel job
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
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

    const { jobId } = await params;

    // Cancel job
    const cancelled = await cancelJob(jobId);

    if (!cancelled) {
      return NextResponse.json(
        {
          error: {
            code: 'JOB_NOT_FOUND',
            message: 'Job not found or cannot be cancelled',
          },
        },
        { status: 404 },
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    // Handle unexpected errors
    console.error('Error in DELETE /api/v1/summaries/[jobId]:', error);

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
