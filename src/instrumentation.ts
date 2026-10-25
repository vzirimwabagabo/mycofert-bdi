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
  }
}
