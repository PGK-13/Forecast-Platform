import { prisma } from '../lib/prisma';
import { UserRepository } from '../repositories/user.repository';
import { BetRepository } from '../repositories/bet.repository';
import { LedgerRepository } from '../repositories/ledger.repository';
import { IdempotencyRepository } from '../repositories/idempotency.repository';

// 初始化仓库实例
const userRepo = new UserRepository();
const betRepo = new BetRepository();
const ledgerRepo = new LedgerRepository();
const idempotencyRepo = new IdempotencyRepository();

/**
 * 投注结果接口
 */
export interface BetResult {
  id: number;         // 投注ID
  userId: number;     // 用户ID
  gameId: string;     // 游戏ID
  amount: number;     // 投注金额
  status: string;     // 投注状态
}

/**
 * 投注服务类 - 处理投注相关的业务逻辑
 */
export class BetService {
  /**
   * 放置投注
   * @param userId 用户ID
   * @param gameId 游戏ID
   * @param amount 投注金额
   * @param idempotencyKey 幂等键，用于防止重复请求
   * @returns 成功返回投注结果，失败返回错误信息
   */
  async placeBet(
    userId: number,
    gameId: string,
    amount: number,
    idempotencyKey: string
  ): Promise<{ success: true; data: BetResult } | { success: false; status: number; error: string }> {
    // 验证幂等键
    if (!idempotencyKey) {
      return { success: false, status: 400, error: 'Idempotency-Key header is required' };
    }

    // 验证投注金额
    if (amount <= 0) {
      return { success: false, status: 400, error: 'Amount must be positive' };
    }

    const requestBody = JSON.stringify({ userId, gameId, amount });

    // 使用事务确保操作原子性
    return prisma.$transaction(async (tx) => {
      // 检查是否存在相同的幂等键
      const existing = await idempotencyRepo.findByKey(idempotencyKey, tx);
      if (existing) {
        if (existing.requestBody !== requestBody) {
          return { success: false, status: 409, error: 'Idempotency key conflict: same key with different request' };
        }
        // 返回缓存的结果
        const cached = JSON.parse(existing.responseBody) as BetResult;
        return { success: true, data: cached };
      }

      // 查找用户并加锁
      const user = await userRepo.findByIdWithLock(userId, tx);
      if (!user) {
        return { success: false, status: 404, error: 'User not found' };
      }

      // 检查余额是否足够
      if (user.balance < amount) {
        return { success: false, status: 400, error: 'Insufficient balance' };
      }

      const newBalance = user.balance - amount;

      // 创建投注记录
      const bet = await betRepo.create({ userId, gameId, amount }, tx);
      // 记录账本
      await ledgerRepo.create(
        { userId, type: 'BET_DEBIT', amount: -amount, betId: bet.id },
        tx
      );
      // 更新用户余额
      await userRepo.updateBalance(userId, newBalance, tx);

      const result: BetResult = {
        id: bet.id,
        userId: bet.userId,
        gameId: bet.gameId,
        amount: bet.amount,
        status: bet.status,
      };

      // 记录幂等键
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

  /**
   * 结算投注
   * @param betId 投注ID
   * @param result 结果，WIN或LOSE
   * @returns 成功返回投注结果和用户余额，失败返回错误信息
   */
  async settle(
    betId: number,
    result: 'WIN' | 'LOSE'
  ): Promise<{ success: true; data: { bet: BetResult; balance: number } } | { success: false; status: number; error: string }> {
    return prisma.$transaction(async (tx) => {
      // 查找投注
      const bet = await betRepo.findById(betId, tx);
      if (!bet) {
        return { success: false, status: 404, error: 'Bet not found' };
      }

      // 检查投注状态
      if (bet.status !== 'PLACED') {
        return { success: false, status: 400, error: 'Bet already settled or cancelled' };
      }

      // 查找用户并加锁
      const user = await userRepo.findByIdWithLock(bet.userId, tx);
      if (!user) {
        return { success: false, status: 404, error: 'User not found' };
      }

      const amount = bet.amount;

      if (result === 'WIN') {
        // 计算 payout (赔率为2)
        const payout = amount * 2;
        const newBalance = user.balance + payout;

        // 记录账本
        await ledgerRepo.create(
          { userId: bet.userId, type: 'BET_CREDIT', amount: payout, betId },
          tx
        );
        // 更新用户余额
        await userRepo.updateBalance(bet.userId, newBalance, tx);
        // 更新投注状态
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
        // 输掉投注，只更新状态
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

  /**
   * 取消投注
   * @param betId 投注ID
   * @returns 成功返回投注结果和用户余额，失败返回错误信息
   */
  async cancel(
    betId: number
  ): Promise<{ success: true; data: { bet: BetResult; balance: number } } | { success: false; status: number; error: string }> {
    return prisma.$transaction(async (tx) => {
      // 查找投注
      const bet = await betRepo.findById(betId, tx);
      if (!bet) {
        return { success: false, status: 404, error: 'Bet not found' };
      }

      // 检查投注状态
      if (bet.status !== 'PLACED') {
        return { success: false, status: 400, error: 'Only PLACED bets can be cancelled' };
      }

      // 查找用户并加锁
      const user = await userRepo.findByIdWithLock(bet.userId, tx);
      if (!user) {
        return { success: false, status: 404, error: 'User not found' };
      }

      // 计算新余额（退款）
      const amount = bet.amount;
      const newBalance = user.balance + amount;

      // 记录账本
      await ledgerRepo.create(
        { userId: bet.userId, type: 'BET_REFUND', amount, betId },
        tx
      );
      // 更新用户余额
      await userRepo.updateBalance(bet.userId, newBalance, tx);
      // 更新投注状态
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
