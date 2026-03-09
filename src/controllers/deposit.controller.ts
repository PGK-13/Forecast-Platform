import { Request, Response } from 'express';
import { DepositService } from '../services/deposit.service';

const depositService = new DepositService();

export async function deposit(req: Request, res: Response) {
  try {
    const userId = parseInt(req.params.id, 10);
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const amount = req.body?.amount;
    if (typeof amount !== 'number') {
      return res.status(400).json({ error: 'Amount must be a number' });
    }

    const idempotencyKey = req.headers['idempotency-key'] as string;

    const result = await depositService.deposit(userId, amount, idempotencyKey);

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
