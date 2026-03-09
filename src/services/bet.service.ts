import { prisma } from '../lib/prisma';
import { UserRepository } from '../repositories/user.repository';
import { BetRepository } from '../repositories/bet.repository';
import { LedgerRepository } from '../repositories/ledger.repository';
import { IdempotencyRepository } from '../repositories/idempotency.repository';

const userRepo = new UserRepository();
const betRepo = new BetRepository();
const ledgerRepo = new LedgerRepository();
const idempotencyRepo = new IdempotencyRepository();

export interface BetResult {
  id: number;
  userId: number;
  gameId: string;
  amount: number;
  status: string;
}

export class BetService {
  async placeBet(
    userId: number,
    gameId: string,
    amount: number,
    idempotencyKey: string
  ): Promise<{ success: true; data: BetResult } | { success: false; status: number; error: string }> {
    if (!idempotencyKey) {
      return { success: false, status: 400, error: 'Idempotency-Key header is required' };
    }

    if (amount <= 0) {
      return { success: false, status: 400, error: 'Amount must be positive' };
    }

    const requestBody = JSON.stringify({ userId, gameId, amount });

    return prisma.$transaction(async (tx) => {
      const existing = await idempotencyRepo.findByKey(idempotencyKey, tx);
      if (existing) {
        if (existing.requestBody !== requestBody) {
          return { success: false, status: 409, error: 'Idempotency key conflict: same key with different request' };
        }
        const cached = JSON.parse(existing.responseBody) as BetResult;
        return { success: true, data: cached };
      }

      const user = await userRepo.findByIdWithLock(userId, tx);
      if (!user) {
        return { success: false, status: 404, error: 'User not found' };
      }

      if (user.balance < amount) {
        return { success: false, status: 400, error: 'Insufficient balance' };
      }

      const newBalance = user.balance - amount;

      const bet = await betRepo.create({ userId, gameId, amount }, tx);
      await ledgerRepo.create(
        { userId, type: 'BET_DEBIT', amount: -amount, betId: bet.id },
        tx
      );
      await userRepo.updateBalance(userId, newBalance, tx);

      const result: BetResult = {
        id: bet.id,
        userId: bet.userId,
        gameId: bet.gameId,
        amount: bet.amount,
        status: bet.status,
      };

      await idempotencyRepo.create(
        {
          key: idempotencyKey,
          type: 'BET',
          requestBody,
          responseStatus: 201,
          responseBody: JSON.stringify(result),
        },
        tx
      );

      return { success: true, data: result };
    });
  }

  async settle(
    betId: number,
    result: 'WIN' | 'LOSE'
  ): Promise<{ success: true; data: { bet: BetResult; balance: number } } | { success: false; status: number; error: string }> {
    return prisma.$transaction(async (tx) => {
      const bet = await betRepo.findById(betId, tx);
      if (!bet) {
        return { success: false, status: 404, error: 'Bet not found' };
      }

      if (bet.status !== 'PLACED') {
        return { success: false, status: 400, error: 'Bet already settled or cancelled' };
      }

      const user = await userRepo.findByIdWithLock(bet.userId, tx);
      if (!user) {
        return { success: false, status: 404, error: 'User not found' };
      }

      const amount = bet.amount;

      if (result === 'WIN') {
        const payout = amount * 2;
        const newBalance = user.balance + payout;

        await ledgerRepo.create(
          { userId: bet.userId, type: 'BET_CREDIT', amount: payout, betId },
          tx
        );
        await userRepo.updateBalance(bet.userId, newBalance, tx);
        await betRepo.updateStatus(betId, 'SETTLED', 'WIN', tx);

        return {
          success: true,
          data: {
            bet: {
              id: bet.id,
              userId: bet.userId,
              gameId: bet.gameId,
              amount: bet.amount,
              status: 'SETTLED',
            },
            balance: newBalance,
          },
        };
      } else {
        await betRepo.updateStatus(betId, 'SETTLED', 'LOSE', tx);
        return {
          success: true,
          data: {
            bet: {
              id: bet.id,
              userId: bet.userId,
              gameId: bet.gameId,
              amount: bet.amount,
              status: 'SETTLED',
            },
            balance: user.balance,
          },
        };
      }
    });
  }

  async cancel(
    betId: number
  ): Promise<{ success: true; data: { bet: BetResult; balance: number } } | { success: false; status: number; error: string }> {
    return prisma.$transaction(async (tx) => {
      const bet = await betRepo.findById(betId, tx);
      if (!bet) {
        return { success: false, status: 404, error: 'Bet not found' };
      }

      if (bet.status !== 'PLACED') {
        return { success: false, status: 400, error: 'Only PLACED bets can be cancelled' };
      }

      const user = await userRepo.findByIdWithLock(bet.userId, tx);
      if (!user) {
        return { success: false, status: 404, error: 'User not found' };
      }

      const amount = bet.amount;
      const newBalance = user.balance + amount;

      await ledgerRepo.create(
        { userId: bet.userId, type: 'BET_REFUND', amount, betId },
        tx
      );
      await userRepo.updateBalance(bet.userId, newBalance, tx);
      await betRepo.updateStatus(betId, 'CANCELLED', undefined, tx);

      return {
        success: true,
        data: {
          bet: {
            id: bet.id,
            userId: bet.userId,
            gameId: bet.gameId,
            amount: bet.amount,
            status: 'CANCELLED',
          },
          balance: newBalance,
        },
      };
    });
  }
}
