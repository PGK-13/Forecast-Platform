import { prisma } from '../lib/prisma';
import { Prisma } from '@prisma/client';

export class UserRepository {
  async findById(id: number) {
    return prisma.user.findUnique({
      where: { id },
    });
  }

  async updateBalance(userId: number, newBalance: number, tx?: Prisma.TransactionClient) {
    const client = tx ?? prisma;
    return client.user.update({
      where: { id: userId },
      data: { balance: newBalance },
    });
  }

  async findByIdWithLock(userId: number, tx: Prisma.TransactionClient) {
    // SQLite doesn't support FOR UPDATE, but we use transaction isolation
    return tx.user.findUnique({
      where: { id: userId },
    });
  }
}
