type SecurityHeaderOptions = {
  apiUrl: string;
  isDevelopment: boolean;
};

export function buildSecurityHeaders(options: SecurityHeaderOptions) {
  const apiOrigin = parseOrigin(options.apiUrl);
  const connectSources = ["'self'", apiOrigin];
  if (options.isDevelopment) connectSources.push('ws:', 'wss:');
  const imageSources = ["'self'", 'blob:', 'data:', 'https:'];
  if (options.isDevelopment) imageSources.push('http:');

  const directives = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${options.isDevelopment ? " 'unsafe-eval'" : ''}`,
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline'",
    `img-src ${imageSources.join(' ')}`,
    "font-src 'self' data:",
    `connect-src ${connectSources.join(' ')}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "frame-src 'none'",
    "base-uri 'self'",
    "form-action 'self' https://pay-sandbox.sepay.vn https://pay.sepay.vn",
    "frame-ancestors 'none'",
  ];

  return [
    { key: 'Content-Security-Policy', value: directives.join('; ') },
    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'DENY' },
  ];
}

function parseOrigin(url: string) {
  try {
    return new URL(url).origin;
  } catch {
    throw new Error(`NEXT_PUBLIC_API_URL must be an absolute URL; received ${url}`);
  }
}
