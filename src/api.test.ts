import path from 'path';

process.env.DATABASE_URL = `file:${path.join(__dirname, '../prisma/test.db')}`;

import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { app } from './index';

const DATABASE_URL = process.env.DATABASE_URL!;

const prisma = new PrismaClient({
  datasources: { db: { url: DATABASE_URL } },
});

async function resetDb() {
  await prisma.$transaction(async (tx) => {
    await tx.idempotencyRecord.deleteMany();
    await tx.ledger.deleteMany();
    await tx.bet.deleteMany();
    await tx.user.deleteMany();

    await tx.user.create({
      data: { id: 1, username: 'alice', balance: 100 },
    });
    await tx.user.create({
      data: { id: 2, username: 'bob', balance: 200 },
    });
    await tx.user.create({
      data: { id: 3, username: 'charlie', balance: 50 },
    });

    await tx.ledger.createMany({
      data: [
        { userId: 1, type: 'DEPOSIT', amount: 100 },
        { userId: 2, type: 'DEPOSIT', amount: 200 },
        { userId: 3, type: 'DEPOSIT', amount: 50 },
      ],
    });
  });
}

describe('Forecast Platform API', () => {
  beforeAll(async () => {
    await resetDb();
  });

  afterEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('1. 充值成功余额增加', () => {
    it('deposit increases user balance', async () => {
      const res = await request(app)
        .post('/api/users/1/deposit')
        .set('Idempotency-Key', 'deposit-key-1')
        .send({ amount: 50 });

      expect(res.status).toBe(200);
      expect(res.body.balance).toBe(150);
      expect(res.body.amount).toBe(50);

      const user = await prisma.user.findUnique({ where: { id: 1 } });
      expect(user?.balance).toBe(150);
    });
  });

  describe('2. 充值幂等性', () => {
    it('same idempotency key returns same result without double credit', async () => {
      const key = 'deposit-idempotent-key';

      const res1 = await request(app)
        .post('/api/users/1/deposit')
        .set('Idempotency-Key', key)
        .send({ amount: 30 });

      const res2 = await request(app)
        .post('/api/users/1/deposit')
        .set('Idempotency-Key', key)
        .send({ amount: 30 });

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
      expect(res1.body.balance).toBe(130);
      expect(res2.body.balance).toBe(130);

      const user = await prisma.user.findUnique({ where: { id: 1 } });
      expect(user?.balance).toBe(130);
    });
  });

  describe('3. 余额不足下注失败', () => {
    it('bet fails when insufficient balance', async () => {
      const res = await request(app)
        .post('/api/bets')
        .set('Idempotency-Key', 'bet-insufficient-1')
        .send({ userId: 3, gameId: 'game-1', amount: 100 });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Insufficient balance');

      const user = await prisma.user.findUnique({ where: { id: 3 } });
      expect(user?.balance).toBe(50);
    });
  });

  describe('4. 下注幂等性', () => {
    it('same idempotency key for bet returns same result without double debit', async () => {
      const key = 'bet-idempotent-key';

      const res1 = await request(app)
        .post('/api/bets')
        .set('Idempotency-Key', key)
        .send({ userId: 1, gameId: 'game-1', amount: 20 });

      const res2 = await request(app)
        .post('/api/bets')
        .set('Idempotency-Key', key)
        .send({ userId: 1, gameId: 'game-1', amount: 20 });

      expect(res1.status).toBe(201);
      expect(res2.status).toBe(201);
      expect(res1.body.id).toBe(res2.body.id);

      const user = await prisma.user.findUnique({ where: { id: 1 } });
      expect(user?.balance).toBe(80);
      const betCount = await prisma.bet.count();
      expect(betCount).toBe(1);
    });
  });

  describe('5. 结算 WIN 增加余额', () => {
    it('settle WIN increases balance (2x payout)', async () => {
      const betRes = await request(app)
        .post('/api/bets')
        .set('Idempotency-Key', 'bet-for-settle-win')
        .send({ userId: 1, gameId: 'game-1', amount: 30 });

      expect(betRes.status).toBe(201);
      const betId = betRes.body.id;

      const settleRes = await request(app)
        .post(`/api/bets/${betId}/settle`)
        .send({ result: 'WIN' });

      expect(settleRes.status).toBe(200);
      // WIN = 2x payout: 100 - 30 + 60 = 130
      expect(settleRes.body.balance).toBe(130);

      const user = await prisma.user.findUnique({ where: { id: 1 } });
      expect(user?.balance).toBe(130);
    });
  });

  describe('6. 已结算订单不能再次结算', () => {
    it('cannot settle an already settled bet', async () => {
      const betRes = await request(app)
        .post('/api/bets')
        .set('Idempotency-Key', 'bet-for-double-settle')
        .send({ userId: 2, gameId: 'game-1', amount: 50 });

      expect(betRes.status).toBe(201);
      const betId = betRes.body.id;

      const settle1 = await request(app)
        .post(`/api/bets/${betId}/settle`)
        .send({ result: 'LOSE' });

      expect(settle1.status).toBe(200);

      const settle2 = await request(app)
        .post(`/api/bets/${betId}/settle`)
        .send({ result: 'WIN' });

      expect(settle2.status).toBe(400);
      expect(settle2.body.error).toContain('already settled');

      const user = await prisma.user.findUnique({ where: { id: 2 } });
      expect(user?.balance).toBe(150);
    });
  });

  describe('Idempotency conflict', () => {
    it('same key different amount returns 409', async () => {
      const key = 'deposit-conflict-key';

      await request(app)
        .post('/api/users/1/deposit')
        .set('Idempotency-Key', key)
        .send({ amount: 10 });

      const res = await request(app)
        .post('/api/users/1/deposit')
        .set('Idempotency-Key', key)
        .send({ amount: 20 });

      expect(res.status).toBe(409);
    });
  });

  describe('Cancel bet', () => {
    it('cancel refunds and sets CANCELLED', async () => {
      const betRes = await request(app)
        .post('/api/bets')
        .set('Idempotency-Key', 'bet-for-cancel')
        .send({ userId: 1, gameId: 'game-1', amount: 25 });

      const betId = betRes.body.id;

      const cancelRes = await request(app)
        .post(`/api/bets/${betId}/cancel`);

      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.bet.status).toBe('CANCELLED');
      expect(cancelRes.body.balance).toBe(100);

      const user = await prisma.user.findUnique({ where: { id: 1 } });
      expect(user?.balance).toBe(100);
    });
  });

  describe('Reconcile', () => {
    it('returns balance and ledger info', async () => {
      const res = await request(app)
        .get('/api/admin/reconcile?userId=1');

      expect(res.status).toBe(200);
      expect(res.body.userId).toBe(1);
      expect(res.body.currentBalance).toBe(100);
      expect(res.body.ledgerBalance).toBe(100);
      expect(res.body.balanceMatch).toBe(true);
    });
  });
});
