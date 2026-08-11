const baseUrl = (process.env.API_BASE_URL ?? 'http://localhost:3005/api').replace(/\/$/, '');
const timeoutMs = positiveInteger(process.env.SMOKE_TIMEOUT_MS, 5_000);
const checks = [
  { path: '/health', validate: (body) => body?.status === 'ok' },
  { path: '/health/ready', validate: (body) => body?.status === 'ready' || body?.status === 'degraded' },
  { path: '/products', validate: (body) => Array.isArray(body?.items) },
];

const results = [];
for (const check of checks) {
  const startedAt = performance.now();
  const response = await fetch(`${baseUrl}${check.path}`, { signal: AbortSignal.timeout(timeoutMs) });
  const body = await response.json().catch(() => null);
  const durationMs = Math.round(performance.now() - startedAt);
  const hardened = response.headers.get('x-content-type-options') === 'nosniff';
  const passed = response.ok && check.validate(body) && hardened;
  results.push({ path: check.path, status: response.status, durationMs, hardened, passed });
}

const passed = results.every((result) => result.passed);
console.log(JSON.stringify({ event: 'api_smoke', baseUrl, passed, results }, null, 2));
if (!passed) process.exitCode = 1;

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
