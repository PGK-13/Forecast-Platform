import { prisma } from '../lib/prisma';
import { Prisma } from '@prisma/client';

/**
 * 幂等性记录仓库类 - 处理与幂等性相关的数据库操作
 */
export class IdempotencyRepository {
  /**
   * 根据键查找幂等性记录
   * @param key 幂等键
   * @param tx 可选的事务客户端，用于在事务中执行操作
   * @returns 找到的幂等性记录
   */
  async findByKey(key: string, tx?: Prisma.TransactionClient) {
    const client = tx ?? prisma;
    return client.idempotencyRecord.findUnique({
      where: { key },
    });
  }

  /**
   * 创建新的幂等性记录
   * @param data 幂等性记录数据，包含键、类型、请求体、响应状态和响应体
   * @param tx 可选的事务客户端，用于在事务中执行操作
   * @returns 创建的幂等性记录
   */
  async create(
    data: {
      key: string;
      type: string;
      requestBody: string;
      responseStatus: number;
      responseBody: string;
    },
    tx?: Prisma.TransactionClient
  ) {
    const client = tx ?? prisma;
    return client.idempotencyRecord.create({
      data,
    });
  }
}
