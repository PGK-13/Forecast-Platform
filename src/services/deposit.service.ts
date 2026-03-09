import { prisma } from '../lib/prisma';
import { UserRepository } from '../repositories/user.repository';
import { LedgerRepository } from '../repositories/ledger.repository';
import { IdempotencyRepository } from '../repositories/idempotency.repository';

const userRepo = new UserRepository();
const ledgerRepo = new LedgerRepository();
const idempotencyRepo = new IdempotencyRepository();

export interface DepositResult {
  userId: number;
  balance: number;
  amount: number;
}

export class DepositService {
  async deposit(
    userId: number,
    amount: number,
    idempotencyKey: string
  ): Promise<{ success: true; data: DepositResult } | { success: false; status: number; error: string }> {
    if (!idempotencyKey) {
      return { success: false, status: 400, error: 'Idempotency-Key header is required' };
    }

    if (amount <= 0) {
      return { success: false, status: 400, error: 'Amount must be positive' };
    }

    const requestBody = JSON.stringify({ userId, amount });

    return prisma.$transaction(async (tx) => {
      const existing = await idempotencyRepo.findByKey(idempotencyKey, tx);
      if (existing) {
        if (existing.requestBody !== requestBody) {
          return { success: false, status: 409, error: 'Idempotency key conflict: same key with different amount' };
        }
        const cached = JSON.parse(existing.responseBody) as DepositResult;
        return { success: true, data: cached };
      }

      const user = await userRepo.findById(userId);
      if (!user) {
        return { success: false, status: 404, error: 'User not found' };
      }

      const newBalance = user.balance + amount;

      await ledgerRepo.create(
        { userId, type: 'DEPOSIT', amount },
        tx
      );
      await userRepo.updateBalance(userId, newBalance, tx);

      const result: DepositResult = {
        userId,
        balance: newBalance,
        amount,
      };

      await idempotencyRepo.create(
        {
          key: idempotencyKey,
          type: 'DEPOSIT',
          requestBody,
          responseStatus: 200,
          responseBody: JSON.stringify(result),
        },
        tx
      );

      return { success: true, data: result };
    });
  }
}
