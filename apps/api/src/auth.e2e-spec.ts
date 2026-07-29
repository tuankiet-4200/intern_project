import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import * as bcrypt from 'bcrypt';
import * as request from 'supertest';
import { AppModule } from './app.module';
import { configureApp } from './configure-app';
import { PrismaService } from './prisma/prisma.service';

describe('Auth and RBAC e2e', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const customerEmail = `e2e-customer-${suffix}@example.com`;
  const adminEmail = `e2e-admin-${suffix}@example.com`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash: await bcrypt.hash('password123', 4),
        fullName: 'E2E Admin',
        role: UserRole.ADMIN,
      },
    });
  });

  afterAll(async () => {
    if (prisma) await prisma.user.deleteMany({ where: { email: { in: [customerEmail, adminEmail] } } });
    if (app) await app.close();
  });

  it('rotates refresh cookies, rejects reuse, and enforces JWT roles', async () => {
    const registration = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: customerEmail,
        password: 'password123',
        fullName: 'E2E Customer',
        role: UserRole.CUSTOMER,
      })
      .expect(201);

    expect(registration.body.accessToken).toEqual(expect.any(String));
    expect(registration.body.refreshToken).toBeUndefined();
    const originalCookie = registration.headers['set-cookie'][0].split(';')[0];
    expect(registration.headers['set-cookie'][0]).toContain('HttpOnly');

    await request(app.getHttpServer()).get('/api/users/me').expect(401);
    await request(app.getHttpServer())
      .get('/api/admin/categories')
      .set('Authorization', `Bearer ${registration.body.accessToken}`)
      .expect(403);

    const refreshed = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', originalCookie)
      .expect(200);
    const rotatedCookie = refreshed.headers['set-cookie'][0].split(';')[0];
    expect(rotatedCookie).not.toBe(originalCookie);

    await request(app.getHttpServer()).post('/api/auth/refresh').set('Cookie', originalCookie).expect(401);
    await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Authorization', `Bearer ${refreshed.body.accessToken}`)
      .expect(200);

    await request(app.getHttpServer()).post('/api/auth/logout').set('Cookie', rotatedCookie).expect(204);
    await request(app.getHttpServer()).post('/api/auth/refresh').set('Cookie', rotatedCookie).expect(401);

    const adminLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: adminEmail, password: 'password123' })
      .expect(200);
    await request(app.getHttpServer())
      .get('/api/admin/categories')
      .set('Authorization', `Bearer ${adminLogin.body.accessToken}`)
      .expect(200);
  });

  it('does not allow public admin provisioning', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: `forbidden-admin-${suffix}@example.com`,
        password: 'password123',
        fullName: 'Forbidden Admin',
        role: UserRole.ADMIN,
      })
      .expect(400);
  });
});
