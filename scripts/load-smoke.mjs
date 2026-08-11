const url = process.env.LOAD_URL ?? 'http://localhost:3005/api/health';
const requests = boundedInteger(process.env.LOAD_REQUESTS, 200, 1, 100_000);
const concurrency = boundedInteger(process.env.LOAD_CONCURRENCY, 20, 1, 1_000);
const maxP95Ms = boundedInteger(process.env.LOAD_MAX_P95_MS, 1_000, 1, 120_000);
const timeoutMs = boundedInteger(process.env.LOAD_TIMEOUT_MS, 5_000, 1, 120_000);
const durations = [];
const failures = [];
let nextRequest = 0;

await Promise.all(Array.from({ length: Math.min(concurrency, requests) }, async () => {
  while (true) {
    const index = nextRequest++;
    if (index >= requests) return;
    const startedAt = performance.now();
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
      durations.push(performance.now() - startedAt);
      if (!response.ok) failures.push({ index, status: response.status });
      await response.arrayBuffer();
    } catch (error) {
      durations.push(performance.now() - startedAt);
      failures.push({ index, error: error instanceof Error ? error.message : 'unknown error' });
    }
  }
}));

durations.sort((left, right) => left - right);
const percentile = (value) => Math.round(durations[Math.max(0, Math.ceil(durations.length * value) - 1)] ?? 0);
const result = {
  event: 'load_smoke', url, requests, concurrency,
  failures: failures.length,
  p50Ms: percentile(0.5), p95Ms: percentile(0.95), p99Ms: percentile(0.99),
  maxP95Ms,
};
const passed = failures.length === 0 && result.p95Ms <= maxP95Ms;
console.log(JSON.stringify({ ...result, passed }, null, 2));
if (!passed) process.exitCode = 1;

function boundedInteger(value, fallback, minimum, maximum) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : fallback;
}
