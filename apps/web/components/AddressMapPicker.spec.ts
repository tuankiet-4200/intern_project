import { describe, expect, it } from '@jest/globals';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AddressMapPicker } from './AddressMapPicker';

describe('AddressMapPicker', () => {
  it('does not create a nested form and keeps map search non-submitting', () => {
    const markup = renderToStaticMarkup(createElement(AddressMapPicker, { onAddress: () => undefined }));

    expect(markup).not.toContain('<form');
    expect(markup).toContain('type="button"');
    expect(markup).toContain('Tìm địa chỉ trên bản đồ');
  });
});
