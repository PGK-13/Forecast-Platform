import { Request, Response } from 'express';
import { BetService } from '../services/bet.service';

// 初始化投注服务实例
const betService = new BetService();

/**
 * 处理放置投注的请求
 * @param req Express请求对象，包含用户ID、游戏ID和投注金额
 * @param res Express响应对象
 */
export async function placeBet(req: Request, res: Response) {
  try {
    const { userId, gameId, amount } = req.body;

    // 验证请求参数
    if (typeof userId !== 'number') {
      return res.status(400).json({ error: 'userId must be a number' });
    }
    if (typeof gameId !== 'string') {
      return res.status(400).json({ error: 'gameId must be a string' });
    }
    if (typeof amount !== 'number') {
      return res.status(400).json({ error: 'amount must be a number' });
    }

    // 获取幂等键
    const idempotencyKey = req.headers['idempotency-key'] as string;

    // 调用服务层放置投注
    const result = await betService.placeBet(userId, gameId, amount, idempotencyKey);

    // 处理响应
    if (result.success) {
      return res.status(201).json(result.data);
    } else {
      return res.status(result.status).json({ error: result.error });
    }
  } catch (err) {
    console.error('Place bet error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * 处理结算投注的请求
 * @param req Express请求对象，包含投注ID和结果
 * @param res Express响应对象
 */
export async function settleBet(req: Request, res: Response) {
  try {
    // 解析投注ID
    const betId = parseInt(req.params.id, 10);
    if (isNaN(betId)) {
      return res.status(400).json({ error: 'Invalid bet ID' });
    }

    // 验证结果参数
    const { result } = req.body;
    if (result !== 'WIN' && result !== 'LOSE') {
      return res.status(400).json({ error: 'result must be WIN or LOSE' });
    }

    // 调用服务层结算投注
    const settleResult = await betService.settle(betId, result);

    // 处理响应
    if (settleResult.success) {
      return res.status(200).json(settleResult.data);
    } else {
      return res.status(settleResult.status).json({ error: settleResult.error });
    }
  } catch (err) {
    console.error('Settle bet error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * 处理取消投注的请求
 * @param req Express请求对象，包含投注ID
 * @param res Express响应对象
 */
export async function cancelBet(req: Request, res: Response) {
  try {
    // 解析投注ID
    const betId = parseInt(req.params.id, 10);
    if (isNaN(betId)) {
      return res.status(400).json({ error: 'Invalid bet ID' });
    }

    // 调用服务层取消投注
    const result = await betService.cancel(betId);

    // 处理响应
    if (result.success) {
      return res.status(200).json(result.data);
    } else {
      return res.status(result.status).json({ error: result.error });
    }
  } catch (err) {
    console.error('Cancel bet error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
