import { prisma } from '../lib/prisma';
import { Prisma } from '@prisma/client';

/**
 * 账本仓库类 - 处理与账本相关的数据库操作
 */
export class LedgerRepository {
  /**
   * 创建新的账本记录
   * @param data 账本数据，包含用户ID、类型、金额和可选的投注ID
   * @param tx 可选的事务客户端，用于在事务中执行操作
   * @returns 创建的账本记录
   */
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

  /**
   * 计算用户的账本金额总和
   * @param userId 用户ID
   * @param tx 可选的事务客户端，用于在事务中执行操作
   * @returns 账本金额总和
   */
  async sumByUserId(userId: number, tx?: Prisma.TransactionClient) {
    const client = tx ?? prisma;
    const result = await client.ledger.aggregate({
      where: { userId },
      _sum: { amount: true },
    });
    return result._sum.amount ?? 0;
  }

  /**
   * 根据用户ID查找账本记录
   * @param userId 用户ID
   * @param tx 可选的事务客户端，用于在事务中执行操作
   * @returns 账本记录列表，按创建时间升序排列
   */
  async findByUserId(userId: number, tx?: Prisma.TransactionClient) {
    const client = tx ?? prisma;
    return client.ledger.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * 根据投注ID查找账本记录
   * @param betId 投注ID
   * @param tx 可选的事务客户端，用于在事务中执行操作
   * @returns 账本记录列表，按创建时间升序排列
   */
  async findByBetId(betId: number, tx?: Prisma.TransactionClient) {
    const client = tx ?? prisma;
    return client.ledger.findMany({
      where: { betId },
      orderBy: { createdAt: 'asc' },
    });
  }
}
