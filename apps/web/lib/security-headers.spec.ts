import { describe, expect, it } from '@jest/globals';
import { buildSecurityHeaders } from './security-headers';

describe('Web security headers', () => {
  it('restricts production sources to the app and configured API origin', () => {
    const headers = buildSecurityHeaders({
      apiUrl: 'https://api.example.com/api',
      isDevelopment: false,
    });
    const csp = headers.find((header) => header.key === 'Content-Security-Policy')?.value;

    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("connect-src 'self' https://api.example.com");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("script-src-attr 'none'");
    expect(csp).toContain("frame-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toContain("'unsafe-eval'");
    expect(headers).toContainEqual({ key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' });
  });

  it('fails fast when the public API URL is not absolute', () => {
    expect(() => buildSecurityHeaders({ apiUrl: '/api', isDevelopment: false }))
      .toThrow('NEXT_PUBLIC_API_URL must be an absolute URL');
  });
});
