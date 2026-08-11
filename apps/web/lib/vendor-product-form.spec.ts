import { describe, expect, it } from '@jest/globals';
import { attributeRowsFromProduct, moveProductImageUrl, normalizeProductImageUrls, serializeProductAttributes } from './vendor-product-form';

describe('vendor product form helpers', () => {
  it('trims, removes empty image rows, and deduplicates URLs', () => {
    expect(normalizeProductImageUrls([
      ' https://images.example.com/one.jpg ',
      '',
      'https://images.example.com/one.jpg',
      'http://images.example.com/two.png',
    ])).toEqual(['https://images.example.com/one.jpg', 'http://images.example.com/two.png']);
  });

  it('rejects unsupported image URLs', () => {
    expect(() => normalizeProductImageUrls(['not-a-url'])).toThrow('URL ảnh không hợp lệ');
    expect(() => normalizeProductImageUrls(['ftp://images.example.com/one.jpg'])).toThrow('http hoặc https');
  });

  it('reorders images so the vendor can change the cover', () => {
    expect(moveProductImageUrl(['one', 'two', 'three'], 1, -1)).toEqual(['two', 'one', 'three']);
    expect(moveProductImageUrl(['one', 'two'], 0, -1)).toEqual(['one', 'two']);
  });

  it('serializes complete unique attributes', () => {
    expect(serializeProductAttributes([
      { key: ' Màu sắc ', value: ' Xanh ' },
      { key: '', value: '' },
      { key: 'Chất liệu', value: 'Thép' },
    ])).toEqual({ 'Màu sắc': 'Xanh', 'Chất liệu': 'Thép' });
    expect(() => serializeProductAttributes([{ key: 'Màu sắc', value: '' }])).toThrow('đủ tên và giá trị');
    expect(() => serializeProductAttributes([
      { key: 'Màu sắc', value: 'Xanh' },
      { key: 'Màu sắc', value: 'Đỏ' },
    ])).toThrow('đang bị trùng');
  });

  it('restores only scalar attributes for editing', () => {
    expect(attributeRowsFromProduct({ color: 'green', weight: 2, featured: true, nested: { value: 1 } })).toEqual([
      { key: 'color', value: 'green' },
      { key: 'weight', value: '2' },
      { key: 'featured', value: 'true' },
    ]);
  });
});
