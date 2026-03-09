import { Router } from 'express';
import { deposit } from '../controllers/deposit.controller';
import { placeBet, settleBet, cancelBet } from '../controllers/bet.controller';
import { reconcile } from '../controllers/reconcile.controller';

const router = Router();

router.post('/api/users/:id/deposit', deposit);
router.post('/api/bets', placeBet);
router.post('/api/bets/:id/settle', settleBet);
router.post('/api/bets/:id/cancel', cancelBet);
router.get('/api/admin/reconcile', reconcile);

export default router;
