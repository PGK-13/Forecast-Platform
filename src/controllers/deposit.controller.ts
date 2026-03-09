import { Request, Response } from 'express';
import { DepositService } from '../services/deposit.service';

// 初始化存款服务实例
const depositService = new DepositService();

/**
 * 处理存款请求
 * @param req Express请求对象，包含用户ID和存款金额
 * @param res Express响应对象
 */
export async function deposit(req: Request, res: Response) {
  try {
    // 解析用户ID
    const userId = parseInt(req.params.id, 10);
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    // 验证存款金额
    const amount = req.body?.amount;
    if (typeof amount !== 'number') {
      return res.status(400).json({ error: 'Amount must be a number' });
    }

    // 获取幂等键
    const idempotencyKey = req.headers['idempotency-key'] as string;

    // 调用服务层处理存款
    const result = await depositService.deposit(userId, amount, idempotencyKey);

    // 处理响应
    if (result.success) {
      return res.status(200).json(result.data);
    } else {
      return res.status(result.status).json({ error: result.error });
    }
  } catch (err) {
    console.error('Deposit error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
