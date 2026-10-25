// Next.js instrumentation hook — runs once when the server starts.
//
// Use this file for startup validation: misconfigured secrets are caught
// here (loud log message) rather than at first request (confusing 503).
// See: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation

export async function register() {
  // Only run checks on the server side (not in the Edge runtime or browser).
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { checkAuthConfiguration } = await import('@/lib/auth');

    const warnings = checkAuthConfiguration();
    if (warnings.length > 0) {
      console.error(
        '\n[startup] ⚠️  Auth configuration problems detected:\n' +
          warnings.map((w) => `  • ${w}`).join('\n') +
          '\n  The admin dashboard will return 503 until these are fixed.\n'
      );
    } else {
      console.info('[startup] ✅ Auth configuration OK.');
    }

    // In production, shared cross-instance rate limiting requires Redis. Without
    // it, each app replica allows the full quota independently — an attacker behind
    // a load balancer gets N × limit login attempts for free. Fail loudly so a
    // misconfigured multi-instance deploy is caught at startup, not mid-attack.
    if (process.env.NODE_ENV === 'production') {
      const hasRedis =
        (process.env.RATE_LIMIT_REDIS_URL || process.env.UPSTASH_REDIS_REST_URL) &&
        (process.env.RATE_LIMIT_REDIS_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN);

      if (!hasRedis) {
        console.error(
          '\n[startup] ❌  PRODUCTION DEPLOYMENT CHECK FAILED:\n' +
            '  Redis is not configured (RATE_LIMIT_REDIS_URL + RATE_LIMIT_REDIS_TOKEN).\n' +
            '  Rate limiting falls back to per-instance in-memory counters, which are\n' +
            '  NOT effective across multiple instances behind a load balancer.\n' +
            '  An attacker can bypass the admin login rate limit by cycling instances.\n' +
            '  Configure Upstash Redis (or any Upstash-compatible endpoint) before\n' +
            '  deploying to production with more than one instance.\n'
        );
        // Hard-fail the process in production so the deployment pipeline (health
        // check / readiness probe) surfaces the misconfiguration before traffic is
        // sent to the instance. Single-instance deploys that intentionally skip
        // Redis can set ALLOW_MEMORY_RATE_LIMIT=1 to opt out of this check.
        if (!process.env.ALLOW_MEMORY_RATE_LIMIT) {
          process.exit(1);
        }
      } else {
        console.info('[startup] ✅ Redis rate-limit store configured.');
      }
    }
  }
}
