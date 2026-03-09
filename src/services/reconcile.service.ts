import { prisma } from '../lib/prisma';
import { UserRepository } from '../repositories/user.repository';
import { LedgerRepository } from '../repositories/ledger.repository';
import { BetRepository } from '../repositories/bet.repository';

// 初始化仓库实例
const userRepo = new UserRepository();
const ledgerRepo = new LedgerRepository();
const betRepo = new BetRepository();

/**
 * 对账结果接口
 */
export interface ReconcileResult {
  userId: number;           // 用户ID
  currentBalance: number;   // 当前余额
  ledgerBalance: number;    // 账本余额
  balanceMatch: boolean;    // 余额是否匹配
  betStats: {               // 投注状态统计
    PLACED: number;         // 已放置的投注数量
    SETTLED: number;        // 已结算的投注数量
    CANCELLED: number;      // 已取消的投注数量
  };
  anomalies: string[];      // 异常列表
}

/**
 * 对账服务类 - 处理对账相关的业务逻辑
 */
export class ReconcileService {
  /**
   * 对用户账户进行对账
   * @param userId 用户ID
   * @returns 对账结果，包含余额匹配情况、投注统计和异常信息
   */
  async reconcile(userId: number): Promise<ReconcileResult | { error: string }> {
    // 查找用户
    const user = await userRepo.findById(userId);
    if (!user) {
      return { error: 'User not found' };
    }

    // 获取账本总和
    const ledgerSum = await ledgerRepo.sumByUserId(userId);
    // 获取用户的账本记录
    const ledgers = await ledgerRepo.findByUserId(userId);
    // 获取用户的投注状态统计
    const betStats = await betRepo.countByUserIdAndStatus(userId);

    // 初始化投注状态统计映射
    const statsMap = {
      PLACED: 0,
      SETTLED: 0,
      CANCELLED: 0,
    };
    // 填充投注状态统计
    for (const s of betStats) {
      const status = s.status as 'PLACED' | 'SETTLED' | 'CANCELLED';
      if (status in statsMap) {
        statsMap[status] = s._count.id;
      }
    }

    // 初始化异常列表
    const anomalies: string[] = [];
    const currentBalance = user.balance;
    const ledgerBalance = Math.round(ledgerSum * 100) / 100;

    // 检查余额是否匹配
    if (Math.abs(currentBalance - ledgerBalance) > 0.001) {
      anomalies.push(`Balance mismatch: DB balance ${currentBalance} vs Ledger sum ${ledgerBalance}`);
    }

    // 获取用户的所有投注及其相关的账本记录
    const bets = await prisma.bet.findMany({
      where: { userId },
      include: { ledgers: true },
    });

    // 检查每个投注的账本记录是否正确
    for (const bet of bets) {
      // 过滤出 debit 和 credit 条目
      const debitEntries = bet.ledgers.filter((l) => l.amount < 0);
      const creditEntries = bet.ledgers.filter((l) => l.amount > 0);

      // 检查已放置的投注是否有对应的扣款记录
      if (bet.status === 'PLACED' && debitEntries.length === 0) {
        anomalies.push(`Bet ${bet.id}: PLACED but missing BET_DEBIT ledger`);
      }

      // 检查已结算的投注是否有正确的账本记录
      if (bet.status === 'SETTLED') {
        if (creditEntries.length > 1) {
          anomalies.push(`Bet ${bet.id}: Duplicate settlement (multiple credit entries)`);
        }
        if (debitEntries.length === 0) {
          anomalies.push(`Bet ${bet.id}: SETTLED but missing original BET_DEBIT`);
        }
      }

      // 检查已取消的投注是否有退款记录
      if (bet.status === 'CANCELLED') {
        const hasRefund = creditEntries.some((l) => l.amount > 0);
        if (!hasRefund) {
          anomalies.push(`Bet ${bet.id}: CANCELLED but missing BET_REFUND`);
        }
      }
    }

    // 返回对账结果
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
