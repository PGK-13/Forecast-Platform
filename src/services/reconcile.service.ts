import { prisma } from '../lib/prisma';
import { UserRepository } from '../repositories/user.repository';
import { LedgerRepository } from '../repositories/ledger.repository';
import { BetRepository } from '../repositories/bet.repository';

const userRepo = new UserRepository();
const ledgerRepo = new LedgerRepository();
const betRepo = new BetRepository();

export interface ReconcileResult {
  userId: number;
  currentBalance: number;
  ledgerBalance: number;
  balanceMatch: boolean;
  betStats: {
    PLACED: number;
    SETTLED: number;
    CANCELLED: number;
  };
  anomalies: string[];
}

export class ReconcileService {
  async reconcile(userId: number): Promise<ReconcileResult | { error: string }> {
    const user = await userRepo.findById(userId);
    if (!user) {
      return { error: 'User not found' };
    }

    const ledgerSum = await ledgerRepo.sumByUserId(userId);
    const ledgers = await ledgerRepo.findByUserId(userId);
    const betStats = await betRepo.countByUserIdAndStatus(userId);

    const statsMap = {
      PLACED: 0,
      SETTLED: 0,
      CANCELLED: 0,
    };
    for (const s of betStats) {
      const status = s.status as 'PLACED' | 'SETTLED' | 'CANCELLED';
      if (status in statsMap) {
        statsMap[status] = s._count.id;
      }
    }

    const anomalies: string[] = [];
    const currentBalance = user.balance;
    const ledgerBalance = Math.round(ledgerSum * 100) / 100;

    if (Math.abs(currentBalance - ledgerBalance) > 0.001) {
      anomalies.push(`Balance mismatch: DB balance ${currentBalance} vs Ledger sum ${ledgerBalance}`);
    }

    const bets = await prisma.bet.findMany({
      where: { userId },
      include: { ledgers: true },
    });

    for (const bet of bets) {
      const debitEntries = bet.ledgers.filter((l) => l.amount < 0);
      const creditEntries = bet.ledgers.filter((l) => l.amount > 0);

      if (bet.status === 'PLACED' && debitEntries.length === 0) {
        anomalies.push(`Bet ${bet.id}: PLACED but missing BET_DEBIT ledger`);
      }

      if (bet.status === 'SETTLED') {
        if (creditEntries.length > 1) {
          anomalies.push(`Bet ${bet.id}: Duplicate settlement (multiple credit entries)`);
        }
        if (debitEntries.length === 0) {
          anomalies.push(`Bet ${bet.id}: SETTLED but missing original BET_DEBIT`);
        }
      }

      if (bet.status === 'CANCELLED') {
        const hasRefund = creditEntries.some((l) => l.amount > 0);
        if (!hasRefund) {
          anomalies.push(`Bet ${bet.id}: CANCELLED but missing BET_REFUND`);
        }
      }
    }

    return {
      userId,
      currentBalance,
      ledgerBalance,
      balanceMatch: Math.abs(currentBalance - ledgerBalance) <= 0.001,
      betStats: statsMap,
      anomalies,
    };
  }
}
