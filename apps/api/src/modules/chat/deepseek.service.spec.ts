import { ConfigService } from '@nestjs/config';
import { ChatSenderType, Prisma } from '@prisma/client';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { buildShopCatalogPrompt, DeepSeekService } from './deepseek.service';

describe('DeepSeekService', () => {
  afterEach(() => { jest.restoreAllMocks(); });

  it('grounds the system prompt in only the supplied shop catalog', () => {
    const prompt = buildShopCatalogPrompt(
      { name: 'North Studio', description: 'Đồ dùng bàn làm việc' },
      [{
        name: 'Đèn bàn Modular',
        slug: 'den-ban-modular',
        description: 'Ánh sáng ấm',
        price: new Prisma.Decimal(590000),
        compareAtPrice: new Prisma.Decimal(650000),
        attributes: { color: 'be' },
        inventory: { onHand: 18, reserved: 3 },
        category: { name: 'Home & Living' },
      }],
    );

    expect(prompt).toContain('North Studio');
    expect(prompt).toContain('Đèn bàn Modular');
    expect(prompt).toContain('Tồn khả dụng: 15');
    expect(prompt).toContain('/products/den-ban-modular');
    expect(prompt).toContain('Không được bịa sản phẩm');
    expect(prompt).not.toContain('sản phẩm của shop khác');
  });

  it('calls the configured DeepSeek endpoint without exposing the key in the payload', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      model: 'deepseek-v4-flash',
      choices: [{ message: { content: 'Shop có đèn bàn Modular còn hàng.' } }],
      usage: { prompt_tokens: 100, completion_tokens: 20 },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    const service = new DeepSeekService(config({
      DEEPSEEK_API_KEY: 'test-secret-key',
      DEEPSEEK_BASE_URL: 'https://api.deepseek.com/',
      DEEPSEEK_MODEL: 'deepseek-v4-flash',
      DEEPSEEK_TIMEOUT_MS: 5000,
    }));

    const answer = await service.answer({
      shop: { name: 'North Studio', description: null },
      products: [],
      history: [{ senderType: ChatSenderType.CUSTOMER, content: 'Shop bán gì?' }],
    });

    expect(answer).toEqual(expect.objectContaining({ content: 'Shop có đèn bàn Modular còn hàng.', promptTokens: 100 }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.deepseek.com/chat/completions');
    expect((options?.headers as Record<string, string>).Authorization).toBe('Bearer test-secret-key');
    expect(String(options?.body)).not.toContain('test-secret-key');
    expect(JSON.parse(String(options?.body))).toEqual(expect.objectContaining({ model: 'deepseek-v4-flash', stream: false }));
  });

  it('fails closed when the backend key is missing', async () => {
    const service = new DeepSeekService(config({}));
    expect(service.isConfigured()).toBe(false);
    await expect(service.answer({ shop: { name: 'Shop', description: null }, products: [], history: [] }))
      .rejects.toThrow('DEEPSEEK_API_KEY is not configured');
  });
});

function config(values: Record<string, unknown>) {
  return { get: (key: string) => values[key] } as ConfigService;
}
