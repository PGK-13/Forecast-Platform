import { prisma } from '../lib/prisma';
import { Prisma } from '@prisma/client';

/**
 * 投注仓库类 - 处理与投注相关的数据库操作
 */
export class BetRepository {
  /**
   * 创建新的投注记录
   * @param data 投注数据，包含用户ID、游戏ID和投注金额
   * @param tx 可选的事务客户端，用于在事务中执行操作
   * @returns 创建的投注记录
   */
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
        status: 'PLACED', // 初始状态为已放置
      },
    });
  }

  /**
   * 根据ID查找投注记录
   * @param id 投注记录ID
   * @param tx 可选的事务客户端，用于在事务中执行操作
   * @returns 找到的投注记录，包含用户信息
   */
  async findById(id: number, tx?: Prisma.TransactionClient) {
    const client = tx ?? prisma;
    return client.bet.findUnique({
      where: { id },
      include: { user: true }, // 包含用户信息
    });
  }

  /**
   * 更新投注状态
   * @param betId 投注记录ID
   * @param status 新的状态
   * @param result 可选的结果，WIN或LOSE
   * @param tx 可选的事务客户端，用于在事务中执行操作
   * @returns 更新后的投注记录
   */
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

  /**
   * 按用户ID和状态统计投注数量
   * @param userId 用户ID
   * @param tx 可选的事务客户端，用于在事务中执行操作
   * @returns 按状态分组的投注数量统计
   */
  async countByUserIdAndStatus(userId: number, tx?: Prisma.TransactionClient) {
    const client = tx ?? prisma;
    return client.bet.groupBy({
      by: ['status'],
      where: { userId },
      _count: { id: true },
    });
  }
}
