// Local in-memory job store for development without Vercel KV

import type { Job, CacheEntry } from './types';

// In-memory storage
const jobs = new Map<string, Job>();
const cache = new Map<string, CacheEntry>();

// Generate cache key from URL and options
export function generateCacheKey(url: string, options?: Record<string, unknown>): string {
  const optionsStr = options ? JSON.stringify(options) : '';
  const combined = `${url}:${optionsStr}`;
  
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  return `cache:${Math.abs(hash)}`;
}

// Save job to memory
export async function saveJob(job: Job): Promise<void> {
  jobs.set(job.id, job);
}

// Get job from memory
export async function getJob(jobId: string): Promise<Job | null> {
  return jobs.get(jobId) || null;
}

// Delete job from memory
export async function deleteJob(jobId: string): Promise<void> {
  jobs.delete(jobId);
}

// Update job in memory
export async function updateJob(
  jobId: string,
  updates: Partial<Job>,
): Promise<Job | null> {
  const job = jobs.get(jobId);
  
  if (!job) {
    return null;
  }
  
  const updatedJob: Job = {
    ...job,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  
  jobs.set(jobId, updatedJob);
  
  return updatedJob;
}

// Save result to cache
export async function saveToCache(
  url: string,
  options: Record<string, unknown>,
  entry: CacheEntry,
): Promise<void> {
  const key = generateCacheKey(url, options);
  cache.set(key, entry);
}

// Get result from cache
export async function getFromCache(
  url: string,
  options?: Record<string, unknown>,
): Promise<CacheEntry | null> {
  const key = generateCacheKey(url, options);
  return cache.get(key) || null;
}

// Delete cache entry
export async function deleteFromCache(
  url: string,
  options?: Record<string, unknown>,
): Promise<void> {
  const key = generateCacheKey(url, options);
  cache.delete(key);
}

// Clear all jobs (for testing/admin)
export async function clearAllJobs(): Promise<void> {
  jobs.clear();
}

// Clear all cache entries (for testing/admin)
export async function clearAllCache(): Promise<void> {
  cache.clear();
}

// Get job count (for monitoring)
export async function getJobCount(): Promise<number> {
  return jobs.size;
}

// Get cache count (for monitoring)
export async function getCacheCount(): Promise<number> {
  return cache.size;
}
