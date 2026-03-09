import { prisma } from '../lib/prisma';
import { Prisma } from '@prisma/client';

export class IdempotencyRepository {
  async findByKey(key: string, tx?: Prisma.TransactionClient) {
    const client = tx ?? prisma;
    return client.idempotencyRecord.findUnique({
      where: { key },
    });
  }

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
