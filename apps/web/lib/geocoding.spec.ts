import { describe, expect, it } from '@jest/globals';
import { buildReverseUrl, buildSearchUrl, GeocodingInputError } from './geocoding';

describe('geocoding proxy inputs', () => {
  it('builds a Vietnam-only Vietnamese search request', () => {
    const url = new URL(buildSearchUrl('  Hà Nội  '));
    expect(url.origin).toBe('https://nominatim.openstreetmap.org');
    expect(url.pathname).toBe('/search');
    expect(url.searchParams.get('q')).toBe('Hà Nội');
    expect(url.searchParams.get('countrycodes')).toBe('vn');
    expect(url.searchParams.get('accept-language')).toBe('vi');
  });

  it('rejects invalid search and coordinate inputs before calling upstream', () => {
    expect(() => buildSearchUrl('HN')).toThrow(GeocodingInputError);
    expect(() => buildReverseUrl('91', '105')).toThrow('Vĩ độ không hợp lệ');
    expect(() => buildReverseUrl('21', '181')).toThrow('Kinh độ không hợp lệ');
  });
});
