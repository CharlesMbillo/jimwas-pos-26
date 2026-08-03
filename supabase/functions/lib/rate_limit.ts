import { SupabaseClient } from "npm:@supabase/supabase-js@2.39.3";

interface RateLimitConfig {
  maxRequests: number;  // Max requests per window
  windowSeconds: number; // Time window in seconds
  keyPrefix: string;    // Redis key prefix for this limit
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}

/**
 * Check if a request is within rate limits using Supabase
 * Stores rate limit data in a simple table
 */
export async function checkRateLimit(
  supabase: SupabaseClient,
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const key = `${config.keyPrefix}:${identifier}`;
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - config.windowSeconds;

  try {
    // Get or create rate limit record
    const { data: record, error: fetchError } = await supabase
      .from("api_rate_limits")
      .select("*")
      .eq("key", key)
      .maybeSingle();

    if (fetchError) {
      console.error("[v0] Rate limit fetch error:", fetchError);
      // On error, allow request (fail open)
      return {
        allowed: true,
        remaining: config.maxRequests,
        resetAt: now + config.windowSeconds,
      };
    }

    // Check if we need to reset the window
    if (!record || record.window_start < windowStart) {
      // Create/reset the record
      const { error: upsertError } = await supabase
        .from("api_rate_limits")
        .upsert(
          {
            key,
            count: 1,
            window_start: now,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "key" }
        );

      if (upsertError) {
        console.error("[v0] Rate limit upsert error:", upsertError);
        return {
          allowed: true,
          remaining: config.maxRequests - 1,
          resetAt: now + config.windowSeconds,
        };
      }

      return {
        allowed: true,
        remaining: config.maxRequests - 1,
        resetAt: now + config.windowSeconds,
      };
    }

    // Check if within limit
    const remaining = config.maxRequests - record.count;

    if (remaining > 0) {
      // Increment counter
      const { error: updateError } = await supabase
        .from("api_rate_limits")
        .update({
          count: record.count + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("key", key);

      if (updateError) {
        console.error("[v0] Rate limit increment error:", updateError);
      }

      return {
        allowed: true,
        remaining: remaining - 1,
        resetAt: record.window_start + config.windowSeconds,
      };
    }

    // Rate limit exceeded
    const retryAfter = record.window_start + config.windowSeconds - now;
    return {
      allowed: false,
      remaining: 0,
      resetAt: record.window_start + config.windowSeconds,
      retryAfter: Math.max(1, retryAfter),
    };
  } catch (error) {
    console.error("[v0] Rate limit check error:", error);
    // Fail open - allow request on error
    return {
      allowed: true,
      remaining: config.maxRequests,
      resetAt: now + config.windowSeconds,
    };
  }
}

/**
 * Get rate limit headers for response
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Limit": "100", // Max per window
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(result.resetAt),
    ...(result.retryAfter && { "Retry-After": String(result.retryAfter) }),
  };
}
