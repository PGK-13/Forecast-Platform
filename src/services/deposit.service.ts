import { prisma } from '../lib/prisma';
import { UserRepository } from '../repositories/user.repository';
import { LedgerRepository } from '../repositories/ledger.repository';
import { IdempotencyRepository } from '../repositories/idempotency.repository';

// 初始化仓库实例
const userRepo = new UserRepository();
const ledgerRepo = new LedgerRepository();
const idempotencyRepo = new IdempotencyRepository();

/**
 * 存款结果接口
 */
export interface DepositResult {
  userId: number;   // 用户ID
  balance: number;  // 存款后的余额
  amount: number;   // 存款金额
}

/**
 * 存款服务类 - 处理存款相关的业务逻辑
 */
export class DepositService {
  /**
   * 处理存款操作
   * @param userId 用户ID
   * @param amount 存款金额
   * @param idempotencyKey 幂等键，用于防止重复请求
   * @returns 成功返回存款结果，失败返回错误信息
   */
  async deposit(
    userId: number,
    amount: number,
    idempotencyKey: string
  ): Promise<{ success: true; data: DepositResult } | { success: false; status: number; error: string }> {
    // 验证幂等键
    if (!idempotencyKey) {
      return { success: false, status: 400, error: 'Idempotency-Key header is required' };
    }

    // 验证存款金额
    if (amount <= 0) {
      return { success: false, status: 400, error: 'Amount must be positive' };
    }

    const requestBody = JSON.stringify({ userId, amount });

    // 使用事务确保操作原子性
    return prisma.$transaction(async (tx) => {
      // 检查是否存在相同的幂等键
      const existing = await idempotencyRepo.findByKey(idempotencyKey, tx);
      if (existing) {
        if (existing.requestBody !== requestBody) {
          return { success: false, status: 409, error: 'Idempotency key conflict: same key with different amount' };
        }
        // 返回缓存的结果
        const cached = JSON.parse(existing.responseBody) as DepositResult;
        return { success: true, data: cached };
      }

      // 查找用户
      const user = await userRepo.findById(userId);
      if (!user) {
        return { success: false, status: 404, error: 'User not found' };
      }

      // 计算新余额
      const newBalance = user.balance + amount;

      // 记录账本
      await ledgerRepo.create(
        { userId, type: 'DEPOSIT', amount },
        tx
      );
      // 更新用户余额
      await userRepo.updateBalance(userId, newBalance, tx);

      const result: DepositResult = {
        userId,
        balance: newBalance,
        amount,
      };

      // 记录幂等键
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
