import { Request, Response } from 'express';
import { ReconcileService } from '../services/reconcile.service';

const reconcileService = new ReconcileService();

export async function reconcile(req: Request, res: Response) {
  try {
    const userIdParam = req.query.userId;
    if (!userIdParam || typeof userIdParam !== 'string') {
      return res.status(400).json({ error: 'userId query parameter is required' });
    }

    const userId = parseInt(userIdParam, 10);
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid userId' });
    }

    const result = await reconcileService.reconcile(userId);

    if ('error' in result) {
      return res.status(404).json({ error: result.error });
    }

    return res.status(200).json(result);
  } catch (err) {
    console.error('Reconcile error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
