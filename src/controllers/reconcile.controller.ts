import { Request, Response } from 'express';
import { ReconcileService } from '../services/reconcile.service';

// 初始化对账服务实例
const reconcileService = new ReconcileService();

/**
 * 处理对账请求
 * @param req Express请求对象，包含用户ID查询参数
 * @param res Express响应对象
 */
export async function reconcile(req: Request, res: Response) {
  try {
    // 获取用户ID查询参数
    const userIdParam = req.query.userId;
    if (!userIdParam || typeof userIdParam !== 'string') {
      return res.status(400).json({ error: 'userId query parameter is required' });
    }

    // 解析用户ID
    const userId = parseInt(userIdParam, 10);
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid userId' });
    }

    // 调用服务层进行对账
    const result = await reconcileService.reconcile(userId);

    // 处理响应
    if ('error' in result) {
      return res.status(404).json({ error: result.error });
    }

    return res.status(200).json(result);
  } catch (err) {
    console.error('Reconcile error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
