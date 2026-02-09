// Rate limiting using Upstash Ratelimit

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { config } from './config';

// Initialize Redis client for rate limiting
let redis: Redis | null = null;

function getRedis(): Redis {
  if (!redis) {
    if (!config.kv.restUrl || !config.kv.restToken) {
      throw new Error('KV_REST_API_URL and KV_REST_API_TOKEN are required for rate limiting');
    }
    redis = new Redis({
      url: config.kv.restUrl,
      token: config.kv.restToken,
    });
  }
  return redis;
}

// Check if rate limiting is available (KV is configured)
function isRateLimitAvailable(): boolean {
  return !config.kv.useLocal && config.rateLimit.enabled;
}

// Rate limiters
let postRateLimiter: Ratelimit | null = null;
let getRateLimiter: Ratelimit | null = null;

function getPostRateLimiter(): Ratelimit {
  if (!postRateLimiter) {
    postRateLimiter = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(config.rateLimit.postRpm, '1 m'),
      analytics: true,
      prefix: 'ratelimit:post',
    });
  }
  return postRateLimiter;
}

function getGetRateLimiter(): Ratelimit {
  if (!getRateLimiter) {
    getRateLimiter = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(config.rateLimit.getRpm, '1 m'),
      analytics: true,
      prefix: 'ratelimit:get',
    });
  }
  return getRateLimiter;
}

// Check rate limit for POST requests
export async function checkPostRateLimit(identifier: string): Promise<{
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}> {
  if (!isRateLimitAvailable()) {
    // Rate limiting is not available (KV not configured or disabled)
    return {
      success: true,
      limit: config.rateLimit.postRpm,
      remaining: config.rateLimit.postRpm,
      reset: Date.now() + 60000,
    };
  }

  const ratelimit = getPostRateLimiter();
  const result = await ratelimit.limit(identifier);

  return {
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
  };
}

// Check rate limit for GET requests
export async function checkGetRateLimit(identifier: string): Promise<{
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}> {
  if (!isRateLimitAvailable()) {
    // Rate limiting is not available (KV not configured or disabled)
    return {
      success: true,
      limit: config.rateLimit.getRpm,
      remaining: config.rateLimit.getRpm,
      reset: Date.now() + 60000,
    };
  }

  const ratelimit = getGetRateLimiter();
  const result = await ratelimit.limit(identifier);

  return {
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
  };
}

// Get client IP from request
export function getClientIp(request: Request): string {
  // Try various headers for client IP
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const cfConnectingIp = request.headers.get('cf-connecting-ip');
  
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  if (realIp) {
    return realIp;
  }
  
  if (cfConnectingIp) {
    return cfConnectingIp;
  }
  
  // Fallback to a default identifier
  return 'unknown';
}

// Rate limit error response
export function rateLimitErrorResponse(limit: number, reset: number): Response {
  return new Response(
    JSON.stringify({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please try again later.',
        details: {
          limit,
          reset: new Date(reset).toISOString(),
        },
      },
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': limit.toString(),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': new Date(reset).toISOString(),
        'Retry-After': Math.ceil((reset - Date.now()) / 1000).toString(),
      },
    },
  );
}
