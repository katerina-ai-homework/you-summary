// Summarization service - coordinates transcript retrieval and summarization

import { nanoid } from 'nanoid';
import type { Job, CreateSummaryRequest, SummaryResult } from './types';
import { getTranscript, getTranscriptJob, mapSupadataError, SupadataError } from './supadataClient';
import { summarizeTranscript, mapGeminiError, GeminiError } from './geminiClient';
import { saveJob, getJob, updateJob, getFromCache, saveToCache } from './jobStore';
import { config } from './config';

// Get job from store
export { getJob } from './jobStore';

// Create a new job
export async function createJob(request: CreateSummaryRequest): Promise<Job> {
  const jobId = nanoid();
  
  const job: Job = {
    id: jobId,
    status: 'processing',
    stage: 'transcript',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    input: {
      title: request.title,
      url: request.url,
      lang: request.lang,
      options: request.options,
    },
    supadata: {
      mode: request.options?.transcriptMode || 'auto',
    },
  };
  
  await saveJob(job);
  
  return job;
}

// Process job - handles transcript retrieval and summarization
export async function processJob(jobId: string): Promise<Job> {
  const job = await getJob(jobId);
  
  if (!job) {
    throw new Error('Job not found');
  }
  
  // Check if job is cancelled
  if (job.status === 'cancelled') {
    return job;
  }
  
  // Check if job is already completed
  if (job.status === 'completed') {
    return job;
  }
  
  // Check if job failed
  if (job.status === 'failed') {
    return job;
  }
  
  try {
    // Stage 1: Get transcript
    if (job.stage === 'transcript') {
      await processTranscriptStage(job);
    }
    
    // Stage 2: Summarize
    if (job.stage === 'summarize') {
      await processSummarizeStage(job);
    }
    
    // Get updated job
    const updatedJob = await getJob(jobId);
    if (!updatedJob) {
      throw new Error('Job not found after processing');
    }
    
    return updatedJob;
  } catch (error) {
    // Handle errors
    let errorCode = 'UNKNOWN_ERROR';
    let errorMessage = 'Unknown error occurred';
    let provider: 'supadata' | 'gemini' | 'backend' = 'backend';
    
    if (error instanceof SupadataError) {
      errorCode = mapSupadataError(error);
      errorMessage = error.message;
      provider = 'supadata';
    } else if (error instanceof GeminiError) {
      errorCode = mapGeminiError(error);
      errorMessage = error.message;
      provider = 'gemini';
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    
    await updateJob(jobId, {
      status: 'failed',
      error: {
        code: errorCode,
        message: errorMessage,
        provider,
      },
    });
    
    const failedJob = await getJob(jobId);
    if (!failedJob) {
      throw new Error('Job not found after error');
    }
    
    return failedJob;
  }
}

// Process transcript stage
async function processTranscriptStage(job: Job): Promise<void> {
  const { url, lang, options } = job.input;
  const mode = options?.transcriptMode || 'auto';
  
  // Check if we already have a Supadata job ID
  if (job.supadata.jobId) {
    // Poll for job status
    const result = await getTranscriptJob(job.supadata.jobId);
    
    if (result.status === 'queued' || result.status === 'active') {
      // Still processing
      return;
    }
    
    if (result.status === 'failed') {
      throw new SupadataError(
        'Transcript job failed',
        'JOB_FAILED',
        500,
      );
    }
    
    if (result.status === 'completed' && result.content) {
      // Transcript ready, move to summarize stage
      await updateJob(job.id, {
        stage: 'summarize',
        supadata: {
          ...job.supadata,
          transcriptLang: result.lang,
          availableLangs: result.availableLangs,
        },
      });
      
      // Store transcript temporarily for summarization
      await saveJob({
        ...job,
        stage: 'summarize',
        supadata: {
          ...job.supadata,
          transcriptLang: result.lang,
          availableLangs: result.availableLangs,
        },
        // Store transcript in a temporary field (not persisted)
        _transcript: result.content,
      } as Job & { _transcript?: string });
      
      return;
    }
  } else {
    // Request new transcript
    const result = await getTranscript({
      url,
      lang,
      text: true,
      mode,
    });
    
    if (result.jobId) {
      // Async job started
      await updateJob(job.id, {
        supadata: {
          ...job.supadata,
          jobId: result.jobId,
        },
      });
    } else if (result.content) {
      // Transcript ready immediately
      await updateJob(job.id, {
        stage: 'summarize',
        supadata: {
          ...job.supadata,
          transcriptLang: result.lang,
          availableLangs: result.availableLangs,
        },
      });
      
      // Store transcript temporarily for summarization
      await saveJob({
        ...job,
        stage: 'summarize',
        supadata: {
          ...job.supadata,
          transcriptLang: result.lang,
          availableLangs: result.availableLangs,
        },
        _transcript: result.content,
      } as Job & { _transcript?: string });
    }
  }
}

// Process summarize stage
async function processSummarizeStage(job: Job): Promise<void> {
  // Get transcript from temporary field
  const jobWithTranscript = await getJob(job.id) as Job & { _transcript?: string };
  
  if (!jobWithTranscript || !jobWithTranscript._transcript) {
    throw new Error('Transcript not found for summarization');
  }
  
  const transcript = jobWithTranscript._transcript;
  const options = job.input.options || {};
  
  // Summarize
  const result = await summarizeTranscript({
    transcript,
    options: {
      length: options.length || 'standard',
      format: options.format || 'bullets',
    },
  });
  
  // Create summary result
  const summaryResult: SummaryResult = {
    summary: result.summary,
    keyPoints: result.keyPoints,
    confidence: result.confidence,
    model: config.gemini.model,
  };
  
  // Update job with result
  await updateJob(job.id, {
    status: 'completed',
    result: summaryResult,
  });
  
  // Cache the result
  await saveToCache(
    job.input.url,
    job.input.options || {},
    {
      result: summaryResult,
      meta: {
        transcriptLang: job.supadata.transcriptLang,
        availableLangs: job.supadata.availableLangs,
      },
      createdAt: new Date().toISOString(),
    },
  );
  
  // Remove temporary transcript field
  await saveJob({
    ...job,
    status: 'completed',
    result: summaryResult,
  });
}

// Cancel job
export async function cancelJob(jobId: string): Promise<boolean> {
  const job = await getJob(jobId);
  
  if (!job) {
    return false;
  }
  
  if (job.status === 'completed' || job.status === 'cancelled') {
    return false;
  }
  
  await updateJob(jobId, {
    status: 'cancelled',
  });
  
  return true;
}

// Check cache for existing result
export async function checkCache(
  url: string,
  options?: Record<string, unknown>,
): Promise<{ result: SummaryResult; meta: { transcriptLang?: string; availableLangs?: string[] } } | null> {
  const cached = await getFromCache(url, options);
  
  if (!cached) {
    return null;
  }
  
  return {
    result: cached.result,
    meta: {
      transcriptLang: cached.meta.transcriptLang,
      availableLangs: cached.meta.availableLangs,
    },
  };
}
