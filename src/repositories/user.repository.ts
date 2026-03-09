import { prisma } from '../lib/prisma';
import { Prisma } from '@prisma/client';

/**
 * 用户仓库类 - 处理与用户相关的数据库操作
 */
export class UserRepository {
  /**
   * 根据ID查找用户
   * @param id 用户ID
   * @returns 找到的用户记录
   */
  async findById(id: number) {
    return prisma.user.findUnique({
      where: { id },
    });
  }

  /**
   * 更新用户余额
   * @param userId 用户ID
   * @param newBalance 新的余额
   * @param tx 可选的事务客户端，用于在事务中执行操作
   * @returns 更新后的用户记录
   */
  async updateBalance(userId: number, newBalance: number, tx?: Prisma.TransactionClient) {
    const client = tx ?? prisma;
    return client.user.update({
      where: { id: userId },
      data: { balance: newBalance },
    });
  }

  /**
   * 根据ID查找用户并加锁（用于事务中）
   * @param userId 用户ID
   * @param tx 事务客户端
   * @returns 找到的用户记录
   * @note SQLite 不支持 FOR UPDATE，但我们使用事务隔离来确保数据一致性
   */
  async findByIdWithLock(userId: number, tx: Prisma.TransactionClient) {
    // SQLite doesn't support FOR UPDATE, but we use transaction isolation
    return tx.user.findUnique({
      where: { id: userId },
    });
  }
}
