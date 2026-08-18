export type SepayCheckoutPayload = {
  provider: 'SEPAY';
  checkoutUrl: string;
  fields: Record<string, string | number | undefined>;
};

const ALLOWED_CHECKOUT_ORIGINS = new Set([
  'https://pay-sandbox.sepay.vn',
  'https://pay.sepay.vn',
]);

export function validateSepayCheckoutUrl(value: string) {
  const url = new URL(value);
  if (!ALLOWED_CHECKOUT_ORIGINS.has(url.origin) || url.pathname !== '/v1/checkout/init') {
    throw new Error('Địa chỉ thanh toán SePay không hợp lệ.');
  }
  return url.toString();
}

export function sepayFormEntries(fields: SepayCheckoutPayload['fields']) {
  return Object.entries(fields)
    .filter((entry): entry is [string, string | number] => entry[1] !== undefined)
    .map(([name, value]) => [name, String(value)] as const);
}

export function submitSepayCheckout(payload: SepayCheckoutPayload) {
  if (payload.provider !== 'SEPAY') throw new Error('Phản hồi thanh toán không đúng nhà cung cấp.');
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = validateSepayCheckoutUrl(payload.checkoutUrl);
  form.hidden = true;
  for (const [name, value] of sepayFormEntries(payload.fields)) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
}
