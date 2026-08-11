export type ProductAttributeRow = { key: string; value: string };

export function normalizeProductImageUrls(values: string[]) {
  const unique = [...new Set(values.map((value) => value.trim()).filter(Boolean))];
  if (unique.length > 8) throw new Error('Mỗi sản phẩm hỗ trợ tối đa 8 ảnh.');
  for (const value of unique) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new Error(`URL ảnh không hợp lệ: ${value}`);
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('URL ảnh phải sử dụng http hoặc https.');
    }
  }
  return unique;
}

export function moveProductImageUrl(values: string[], index: number, direction: -1 | 1) {
  const target = index + direction;
  if (index < 0 || index >= values.length || target < 0 || target >= values.length) return values;
  const reordered = [...values];
  [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
  return reordered;
}

export function serializeProductAttributes(rows: ProductAttributeRow[]) {
  const attributes: Record<string, string> = {};
  for (const row of rows) {
    const key = row.key.trim();
    const value = row.value.trim();
    if (!key && !value) continue;
    if (!key || !value) throw new Error('Mỗi thuộc tính phải có đủ tên và giá trị.');
    if (Object.hasOwn(attributes, key)) throw new Error(`Thuộc tính “${key}” đang bị trùng.`);
    attributes[key] = value;
  }
  if (Object.keys(attributes).length > 20) throw new Error('Mỗi sản phẩm hỗ trợ tối đa 20 thuộc tính.');
  return attributes;
}

export function attributeRowsFromProduct(value: unknown): ProductAttributeRow[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  return Object.entries(value)
    .filter((entry): entry is [string, string | number | boolean] => ['string', 'number', 'boolean'].includes(typeof entry[1]))
    .map(([key, attribute]) => ({ key, value: String(attribute) }));
}
