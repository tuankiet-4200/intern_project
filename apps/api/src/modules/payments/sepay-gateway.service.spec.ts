import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { describe, expect, it } from '@jest/globals';
import { SepayGatewayService } from './sepay-gateway.service';

describe('SepayGatewayService', () => {
  const configured = () => new SepayGatewayService(new ConfigService({
    SEPAY_ENV: 'sandbox',
    SEPAY_MERCHANT_ID: 'merchant-test',
    SEPAY_SECRET_KEY: 'secret-test',
    SEPAY_IPN_SECRET: 'ipn-secret-test',
    SEPAY_PAYMENT_METHOD: 'BANK_TRANSFER',
    SEPAY_RETURN_URL: 'http://localhost:3000/payments/sepay/return',
  }));

  it('builds a signed one-time hosted checkout using the payment UUID as invoice number', () => {
    const payload = configured().createPayment({
      paymentId: '90924f42-48ab-4f79-a0b6-a06fdbe4ba24',
      parentOrderId: '31d30e15-a271-438d-b354-91ee3ed825c4',
      orderNumber: 'ORD-TEST',
      amount: '125000.00',
      customerId: 'd30ae433-2519-4ba1-9058-050f0e8ed4ca',
    });

    expect(payload.checkoutUrl).toBe('https://pay-sandbox.sepay.vn/v1/checkout/init');
    expect(payload.fields).toMatchObject({
      merchant: 'merchant-test',
      order_invoice_number: '90924f42-48ab-4f79-a0b6-a06fdbe4ba24',
      order_amount: 125000,
      currency: 'VND',
      payment_method: 'BANK_TRANSFER',
    });
    expect(payload.fields.signature).toEqual(expect.any(String));
    expect(payload.fields.success_url).toContain('status=success');
    expect(payload.fields.success_url).toContain('payment_id=90924f42-48ab-4f79-a0b6-a06fdbe4ba24');
  });

  it('fails closed for missing configuration and invalid IPN secrets', () => {
    expect(() => new SepayGatewayService(new ConfigService()).assertConfigured())
      .toThrow(ServiceUnavailableException);
    expect(() => configured().verifyIpnSecret('wrong-secret')).toThrow(UnauthorizedException);
    expect(() => configured().verifyIpnSecret('ipn-secret-test')).not.toThrow();
    expect(new SepayGatewayService(new ConfigService({
      SEPAY_ENV: 'production',
      SEPAY_MERCHANT_ID: 'merchant',
      SEPAY_SECRET_KEY: 'secret',
      SEPAY_RETURN_URL: 'http://shop.example/payments/sepay/return',
    })).configuration()).toEqual({ provider: 'SEPAY', configured: false });
  });
});
