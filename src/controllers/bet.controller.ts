import { Request, Response } from 'express';
import { BetService } from '../services/bet.service';

const betService = new BetService();

export async function placeBet(req: Request, res: Response) {
  try {
    const { userId, gameId, amount } = req.body;

    if (typeof userId !== 'number') {
      return res.status(400).json({ error: 'userId must be a number' });
    }
    if (typeof gameId !== 'string') {
      return res.status(400).json({ error: 'gameId must be a string' });
    }
    if (typeof amount !== 'number') {
      return res.status(400).json({ error: 'amount must be a number' });
    }

    const idempotencyKey = req.headers['idempotency-key'] as string;

    const result = await betService.placeBet(userId, gameId, amount, idempotencyKey);

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

export async function settleBet(req: Request, res: Response) {
  try {
    const betId = parseInt(req.params.id, 10);
    if (isNaN(betId)) {
      return res.status(400).json({ error: 'Invalid bet ID' });
    }

    const { result } = req.body;
    if (result !== 'WIN' && result !== 'LOSE') {
      return res.status(400).json({ error: 'result must be WIN or LOSE' });
    }

    const settleResult = await betService.settle(betId, result);

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

export async function cancelBet(req: Request, res: Response) {
  try {
    const betId = parseInt(req.params.id, 10);
    if (isNaN(betId)) {
      return res.status(400).json({ error: 'Invalid bet ID' });
    }

    const result = await betService.cancel(betId);

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
