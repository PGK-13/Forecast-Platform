import { prisma } from '../lib/prisma';
import { Prisma } from '@prisma/client';

export class BetRepository {
  async create(
    data: { userId: number; gameId: string; amount: number },
    tx?: Prisma.TransactionClient
  ) {
    const client = tx ?? prisma;
    return client.bet.create({
      data: {
        userId: data.userId,
        gameId: data.gameId,
        amount: data.amount,
        status: 'PLACED',
      },
    });
  }

  async findById(id: number, tx?: Prisma.TransactionClient) {
    const client = tx ?? prisma;
    return client.bet.findUnique({
      where: { id },
      include: { user: true },
    });
  }

  async updateStatus(
    betId: number,
    status: string,
    result?: 'WIN' | 'LOSE',
    tx?: Prisma.TransactionClient
  ) {
    const client = tx ?? prisma;
    return client.bet.update({
      where: { id: betId },
      data: { status, result: result ?? undefined },
    });
  }

  async countByUserIdAndStatus(userId: number, tx?: Prisma.TransactionClient) {
    const client = tx ?? prisma;
    return client.bet.groupBy({
      by: ['status'],
      where: { userId },
      _count: { id: true },
    });
  }
}
