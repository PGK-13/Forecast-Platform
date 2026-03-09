import { prisma } from '../lib/prisma';
import { Prisma } from '@prisma/client';

export class LedgerRepository {
  async create(
    data: {
      userId: number;
      type: string;
      amount: number;
      betId?: number;
    },
    tx?: Prisma.TransactionClient
  ) {
    const client = tx ?? prisma;
    return client.ledger.create({
      data: {
        userId: data.userId,
        type: data.type,
        amount: data.amount,
        betId: data.betId,
      },
    });
  }

  async sumByUserId(userId: number, tx?: Prisma.TransactionClient) {
    const client = tx ?? prisma;
    const result = await client.ledger.aggregate({
      where: { userId },
      _sum: { amount: true },
    });
    return result._sum.amount ?? 0;
  }

  async findByUserId(userId: number, tx?: Prisma.TransactionClient) {
    const client = tx ?? prisma;
    return client.ledger.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findByBetId(betId: number, tx?: Prisma.TransactionClient) {
    const client = tx ?? prisma;
    return client.ledger.findMany({
      where: { betId },
      orderBy: { createdAt: 'asc' },
    });
  }
}
