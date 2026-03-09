'use client';

import { useState, useEffect } from 'react';

// 使用相对路径，由 Next.js rewrites 代理到后端 3001
const API_BASE = '';

type ApiResult = { ok: boolean; status: number; data?: unknown; error?: string };

async function api(
  method: string,
  path: string,
  body?: object,
  headers?: Record<string, string>
): Promise<ApiResult> {
  try {
    const url = API_BASE ? `${API_BASE}${path}` : path;
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    return {
      ok: res.ok,
      status: res.status,
      data: Object.keys(data).length ? data : undefined,
      error: data.error,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Request failed';
    return {
      ok: false,
      status: 0,
      error: `${msg}（请确认后端已启动：npm run dev:server 或 npm run dev）`,
    };
  }
}

function Result({ result }: { result: ApiResult | null }) {
  if (!result) return null;
  return (
    <pre
      className={`mt-2 rounded-lg border p-3 text-sm overflow-auto max-h-48 ${
        result.ok
          ? 'border-green-200 bg-green-50 text-green-900'
          : 'border-red-200 bg-red-50 text-red-900'
      }`}
    >
      {result.status > 0 && <span>HTTP {result.status} </span>}
      {result.error && <span className="block font-medium">{result.error}</span>}
      {result.data != null && (
        <code>{JSON.stringify(result.data, null, 2)}</code>
      )}
    </pre>
  );
}

export default function Home() {
  const [backendOk, setBackendOk] = useState<boolean | null>(null);

  useEffect(() => {
    fetch('/health')
      .then((r) => r.ok)
      .then(setBackendOk)
      .catch(() => setBackendOk(false));
  }, []);

  const [depositResult, setDepositResult] = useState<ApiResult | null>(null);
  const [betResult, setBetResult] = useState<ApiResult | null>(null);
  const [settleResult, setSettleResult] = useState<ApiResult | null>(null);
  const [cancelResult, setCancelResult] = useState<ApiResult | null>(null);
  const [reconcileResult, setReconcileResult] = useState<ApiResult | null>(null);

  const [depositUserId, setDepositUserId] = useState('1');
  const [depositAmount, setDepositAmount] = useState('50');
  const [depositKey, setDepositKey] = useState('deposit-visual-key');

  const [betUserId, setBetUserId] = useState('1');
  const [betGameId, setBetGameId] = useState('game-1');
  const [betAmount, setBetAmount] = useState('20');
  const [betKey, setBetKey] = useState('bet-visual-key');

  const [settleBetId, setSettleBetId] = useState('');
  const [settleResultType, setSettleResultType] = useState<'WIN' | 'LOSE'>('WIN');

  const [cancelBetId, setCancelBetId] = useState('');

  const [reconcileUserId, setReconcileUserId] = useState('1');

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">
        Forecast Platform 可视化接口测试
      </h1>
      {backendOk === false && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">
          ⚠️ 后端未连接：请在项目根目录运行 <code className="bg-amber-100 px-1 rounded">npm run dev</code> 或 <code className="bg-amber-100 px-1 rounded">npm run dev:server</code> 启动 Express 后端（端口 3001）
        </div>
      )}
      {backendOk === true && (
        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-3 text-green-800 text-sm">
          ✓ 后端已连接
        </div>
      )}
      <p className="text-gray-600 mb-8">
        后端 API 通过代理转发到 <code className="bg-gray-100 px-1 rounded">localhost:3001</code>
      </p>

      <div className="space-y-8">
        {/* 充值 */}
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">1. 充值 POST /api/users/:id/deposit</h2>
          <div className="flex flex-wrap gap-3 items-end">
            <label className="flex flex-col gap-1">
              <span className="text-sm text-gray-600">用户 ID</span>
              <input
                type="number"
                value={depositUserId}
                onChange={(e) => setDepositUserId(e.target.value)}
                className="rounded border border-gray-300 px-3 py-2 w-24"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm text-gray-600">金额</span>
              <input
                type="number"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                className="rounded border border-gray-300 px-3 py-2 w-28"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm text-gray-600">Idempotency-Key</span>
              <input
                type="text"
                value={depositKey}
                onChange={(e) => setDepositKey(e.target.value)}
                className="rounded border border-gray-300 px-3 py-2 w-48"
              />
            </label>
            <button
              type="button"
              onClick={async () => {
                const r = await api(
                  'POST',
                  `/api/users/${depositUserId}/deposit`,
                  { amount: Number(depositAmount) },
                  { 'Idempotency-Key': depositKey }
                );
                setDepositResult(r);
              }}
              className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              发送充值
            </button>
          </div>
          <Result result={depositResult} />
        </section>

        {/* 下注 */}
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">2. 下注 POST /api/bets</h2>
          <div className="flex flex-wrap gap-3 items-end">
            <label className="flex flex-col gap-1">
              <span className="text-sm text-gray-600">userId</span>
              <input
                type="number"
                value={betUserId}
                onChange={(e) => setBetUserId(e.target.value)}
                className="rounded border border-gray-300 px-3 py-2 w-24"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm text-gray-600">gameId</span>
              <input
                type="text"
                value={betGameId}
                onChange={(e) => setBetGameId(e.target.value)}
                className="rounded border border-gray-300 px-3 py-2 w-28"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm text-gray-600">amount</span>
              <input
                type="number"
                value={betAmount}
                onChange={(e) => setBetAmount(e.target.value)}
                className="rounded border border-gray-300 px-3 py-2 w-24"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm text-gray-600">Idempotency-Key</span>
              <input
                type="text"
                value={betKey}
                onChange={(e) => setBetKey(e.target.value)}
                className="rounded border border-gray-300 px-3 py-2 w-40"
              />
            </label>
            <button
              type="button"
              onClick={async () => {
                const r = await api(
                  'POST',
                  '/api/bets',
                  {
                    userId: Number(betUserId),
                    gameId: betGameId,
                    amount: Number(betAmount),
                  },
                  { 'Idempotency-Key': betKey }
                );
                setBetResult(r);
              }}
              className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              下注
            </button>
          </div>
          <Result result={betResult} />
        </section>

        {/* 结算 */}
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">3. 结算 POST /api/bets/:id/settle</h2>
          <div className="flex flex-wrap gap-3 items-end">
            <label className="flex flex-col gap-1">
              <span className="text-sm text-gray-600">Bet ID</span>
              <input
                type="number"
                value={settleBetId}
                onChange={(e) => setSettleBetId(e.target.value)}
                placeholder="下注返回的 id"
                className="rounded border border-gray-300 px-3 py-2 w-32"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm text-gray-600">结果</span>
              <select
                value={settleResultType}
                onChange={(e) => setSettleResultType(e.target.value as 'WIN' | 'LOSE')}
                className="rounded border border-gray-300 px-3 py-2 w-24"
              >
                <option value="WIN">WIN</option>
                <option value="LOSE">LOSE</option>
              </select>
            </label>
            <button
              type="button"
              onClick={async () => {
                if (!settleBetId.trim()) {
                  setSettleResult({ ok: false, status: 0, error: '请填写 Bet ID' });
                  return;
                }
                const r = await api('POST', `/api/bets/${settleBetId}/settle`, {
                  result: settleResultType,
                });
                setSettleResult(r);
              }}
              className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              结算
            </button>
          </div>
          <Result result={settleResult} />
        </section>

        {/* 取消 */}
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">4. 取消 POST /api/bets/:id/cancel</h2>
          <div className="flex flex-wrap gap-3 items-end">
            <label className="flex flex-col gap-1">
              <span className="text-sm text-gray-600">Bet ID</span>
              <input
                type="number"
                value={cancelBetId}
                onChange={(e) => setCancelBetId(e.target.value)}
                placeholder="下注返回的 id"
                className="rounded border border-gray-300 px-3 py-2 w-32"
              />
            </label>
            <button
              type="button"
              onClick={async () => {
                if (!cancelBetId.trim()) {
                  setCancelResult({ ok: false, status: 0, error: '请填写 Bet ID' });
                  return;
                }
                const r = await api('POST', `/api/bets/${cancelBetId}/cancel`);
                setCancelResult(r);
              }}
              className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              取消订单
            </button>
          </div>
          <Result result={cancelResult} />
        </section>

        {/* 对账 */}
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">5. 对账 GET /api/admin/reconcile?userId=</h2>
          <div className="flex flex-wrap gap-3 items-end">
            <label className="flex flex-col gap-1">
              <span className="text-sm text-gray-600">用户 ID</span>
              <input
                type="number"
                value={reconcileUserId}
                onChange={(e) => setReconcileUserId(e.target.value)}
                className="rounded border border-gray-300 px-3 py-2 w-24"
              />
            </label>
            <button
              type="button"
              onClick={async () => {
                const r = await api('GET', `/api/admin/reconcile?userId=${reconcileUserId}`);
                setReconcileResult(r);
              }}
              className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              对账
            </button>
          </div>
          <Result result={reconcileResult} />
        </section>
      </div>
    </main>
  );
}
