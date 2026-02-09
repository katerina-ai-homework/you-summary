// Job store using Vercel KV (Upstash Redis) or local storage

import { Redis } from '@upstash/redis';
import { config } from './config';
import type { Job, CacheEntry } from './types';

// Import local storage for development
import * as localStore from './jobStore.local';

// Initialize Redis client
let redis: Redis | null = null;

function getRedis(): Redis {
  if (!redis) {
    if (!config.kv.restUrl || !config.kv.restToken) {
      throw new Error('KV_REST_API_URL and KV_REST_API_TOKEN are required');
    }
    redis = new Redis({
      url: config.kv.restUrl,
      token: config.kv.restToken,
    });
  }
  return redis;
}

// Check if using local storage
function isLocalMode(): boolean {
  return config.kv.useLocal;
}

// Generate cache key from URL and options
export function generateCacheKey(url: string, options?: Record<string, unknown>): string {
  const optionsStr = options ? JSON.stringify(options) : '';
  const combined = `${url}:${optionsStr}`;
  
  // Simple hash function (for production, use crypto.createHash)
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  return `cache:${Math.abs(hash)}`;
}

// Save job to KV or local storage
export async function saveJob(job: Job): Promise<void> {
  if (isLocalMode()) {
    return localStore.saveJob(job);
  }
  
  const redis = getRedis();
  const key = `job:${job.id}`;
  
  await redis.set(key, JSON.stringify(job), {
    ex: config.ttl.job,
  });
}

// Get job from KV or local storage
export async function getJob(jobId: string): Promise<Job | null> {
  if (isLocalMode()) {
    return localStore.getJob(jobId);
  }
  
  const redis = getRedis();
  const key = `job:${jobId}`;
  
  const data = await redis.get<string>(key);
  
  if (!data) {
    return null;
  }
  
  try {
    return JSON.parse(data) as Job;
  } catch {
    return null;
  }
}

// Delete job from KV or local storage
export async function deleteJob(jobId: string): Promise<void> {
  if (isLocalMode()) {
    return localStore.deleteJob(jobId);
  }
  
  const redis = getRedis();
  const key = `job:${jobId}`;
  
  await redis.del(key);
}

// Update job in KV or local storage
export async function updateJob(
  jobId: string,
  updates: Partial<Job>,
): Promise<Job | null> {
  if (isLocalMode()) {
    return localStore.updateJob(jobId, updates);
  }
  
  const job = await getJob(jobId);
  
  if (!job) {
    return null;
  }
  
  const updatedJob: Job = {
    ...job,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  
  await saveJob(updatedJob);
  
  return updatedJob;
}

// Save result to cache
export async function saveToCache(
  url: string,
  options: Record<string, unknown>,
  entry: CacheEntry,
): Promise<void> {
  if (isLocalMode()) {
    return localStore.saveToCache(url, options, entry);
  }
  
  const redis = getRedis();
  const key = generateCacheKey(url, options);
  
  await redis.set(key, JSON.stringify(entry), {
    ex: config.ttl.cache,
  });
}

// Get result from cache
export async function getFromCache(
  url: string,
  options?: Record<string, unknown>,
): Promise<CacheEntry | null> {
  if (isLocalMode()) {
    return localStore.getFromCache(url, options);
  }
  
  const redis = getRedis();
  const key = generateCacheKey(url, options);
  
  const data = await redis.get<string>(key);
  
  if (!data) {
    return null;
  }
  
  try {
    return JSON.parse(data) as CacheEntry;
  } catch {
    return null;
  }
}

// Delete cache entry
export async function deleteFromCache(
  url: string,
  options?: Record<string, unknown>,
): Promise<void> {
  if (isLocalMode()) {
    return localStore.deleteFromCache(url, options);
  }
  
  const redis = getRedis();
  const key = generateCacheKey(url, options);
  
  await redis.del(key);
}

// Clear all jobs (for testing/admin)
export async function clearAllJobs(): Promise<void> {
  if (isLocalMode()) {
    return localStore.clearAllJobs();
  }
  
  const redis = getRedis();
  
  // Get all job keys
  const keys = await redis.keys('job:*');
  
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}

// Clear all cache entries (for testing/admin)
export async function clearAllCache(): Promise<void> {
  if (isLocalMode()) {
    return localStore.clearAllCache();
  }
  
  const redis = getRedis();
  
  // Get all cache keys
  const keys = await redis.keys('cache:*');
  
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}

// Get job count (for monitoring)
export async function getJobCount(): Promise<number> {
  if (isLocalMode()) {
    return localStore.getJobCount();
  }
  
  const redis = getRedis();
  
  const keys = await redis.keys('job:*');
  
  return keys.length;
}

// Get cache count (for monitoring)
export async function getCacheCount(): Promise<number> {
  if (isLocalMode()) {
    return localStore.getCacheCount();
  }
  
  const redis = getRedis();
  
  const keys = await redis.keys('cache:*');
  
  return keys.length;
}
