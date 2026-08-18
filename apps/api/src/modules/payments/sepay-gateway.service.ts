import { BadRequestException, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SePayPgClient } from 'sepay-pg-node';
import { timingSafeEqual } from 'node:crypto';

type SepayEnvironment = 'sandbox' | 'production';
type SepayCheckoutMethod = 'BANK_TRANSFER' | 'NAPAS_BANK_TRANSFER';

export type SepayCheckoutPayload = {
  provider: 'SEPAY';
  checkoutUrl: string;
  fields: Record<string, string | number | undefined>;
};

type CreateSepayPaymentInput = {
  paymentId: string;
  parentOrderId: string;
  orderNumber: string;
  amount: string;
  customerId: string;
};

@Injectable()
export class SepayGatewayService {
  constructor(private readonly config: ConfigService = new ConfigService()) {}

  configuration() {
    try {
      this.assertConfigured();
      return { provider: 'SEPAY' as const, configured: true };
    } catch {
      return { provider: 'SEPAY' as const, configured: false };
    }
  }

  isConfigured() {
    return Boolean(
      this.config.get<string>('SEPAY_MERCHANT_ID')?.trim()
      && this.config.get<string>('SEPAY_SECRET_KEY')?.trim()
      && this.config.get<string>('SEPAY_RETURN_URL')?.trim(),
    );
  }

  assertConfigured() {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        'SePay is not configured. Set SEPAY_MERCHANT_ID, SEPAY_SECRET_KEY and SEPAY_RETURN_URL.',
      );
    }
    this.environment();
    this.paymentMethod();
    this.baseReturnUrl();
  }

  createPayment(input: CreateSepayPaymentInput): SepayCheckoutPayload {
    const client = this.createClient();
    const amount = Number(input.amount);
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      throw new BadRequestException('SePay supports positive whole-number VND amounts only');
    }

    const fields = client.checkout.initOneTimePaymentFields({
      operation: 'PURCHASE',
      payment_method: this.paymentMethod(),
      order_invoice_number: input.paymentId,
      order_amount: amount,
      currency: 'VND',
      order_description: `Thanh toan don ${input.orderNumber}`,
      customer_id: input.customerId,
      success_url: this.returnUrl('success', input),
      error_url: this.returnUrl('error', input),
      cancel_url: this.returnUrl('cancel', input),
      custom_data: JSON.stringify({
        payment_id: input.paymentId,
        parent_order_id: input.parentOrderId,
      }),
    });

    return {
      provider: 'SEPAY',
      checkoutUrl: client.checkout.initCheckoutUrl(),
      fields,
    };
  }

  async retrieveOrder(paymentId: string): Promise<unknown> {
    const response = await this.createClient().order.retrieve(paymentId);
    return response.data;
  }

  verifyIpnSecret(supplied: string | undefined) {
    const expected = this.config.get<string>('SEPAY_IPN_SECRET')?.trim();
    if (!expected) throw new ServiceUnavailableException('SePay IPN is not configured');
    const received = supplied?.trim() || '';
    const expectedBuffer = Buffer.from(expected);
    const receivedBuffer = Buffer.from(received);
    if (
      expectedBuffer.length !== receivedBuffer.length
      || !timingSafeEqual(expectedBuffer, receivedBuffer)
    ) {
      throw new UnauthorizedException('SePay IPN secret is invalid');
    }
  }

  private createClient() {
    this.assertConfigured();
    return new SePayPgClient({
      env: this.environment(),
      merchant_id: this.config.get<string>('SEPAY_MERCHANT_ID')!.trim(),
      secret_key: this.config.get<string>('SEPAY_SECRET_KEY')!.trim(),
    });
  }

  private environment(): SepayEnvironment {
    const value = this.config.get<string>('SEPAY_ENV')?.trim().toLowerCase() || 'sandbox';
    if (value !== 'sandbox' && value !== 'production') {
      throw new ServiceUnavailableException('SEPAY_ENV must be sandbox or production');
    }
    return value;
  }

  private paymentMethod(): SepayCheckoutMethod {
    const value = this.config.get<string>('SEPAY_PAYMENT_METHOD')?.trim().toUpperCase() || 'BANK_TRANSFER';
    if (value !== 'BANK_TRANSFER' && value !== 'NAPAS_BANK_TRANSFER') {
      throw new ServiceUnavailableException(
        'SEPAY_PAYMENT_METHOD must be BANK_TRANSFER or NAPAS_BANK_TRANSFER',
      );
    }
    return value;
  }

  private returnUrl(
    status: 'success' | 'error' | 'cancel',
    input: Pick<CreateSepayPaymentInput, 'paymentId' | 'parentOrderId'>,
  ) {
    const url = this.baseReturnUrl();
    url.searchParams.set('status', status);
    url.searchParams.set('payment_id', input.paymentId);
    url.searchParams.set('order_id', input.parentOrderId);
    return url.toString();
  }

  private baseReturnUrl() {
    const raw = this.config.get<string>('SEPAY_RETURN_URL')!.trim();
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      throw new ServiceUnavailableException('SEPAY_RETURN_URL must be an absolute URL');
    }
    if (this.environment() === 'production' && url.protocol !== 'https:') {
      throw new ServiceUnavailableException('SEPAY_RETURN_URL must use HTTPS in production');
    }
    return url;
  }
}
