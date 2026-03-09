# Forecast Platform

简化版类 Polymarket 的预测平台核心后端逻辑。

## 技术栈

- **后端**: Node.js + TypeScript + Express + Prisma + SQLite
- **测试**: Jest
- **可视化测试前端**: Next.js（访问 3000 端口可对接口进行可视化调用）

## 架构

分层架构：`Controller -> Service -> Repository -> Prisma`

```
forecast-platform/
├── src/                 # 后端
│   ├── controllers/     # HTTP 请求处理
│   ├── services/        # 业务逻辑
│   ├── repositories/    # 数据访问
│   ├── lib/             # 共享依赖 (Prisma client)
│   ├── routes/          # API 路由
│   └── index.ts         # 应用入口
├── web/                 # 可视化测试前端 (Next.js)
│   └── app/
│       └── page.tsx     # 单页：充值 / 下注 / 结算 / 取消 / 对账
└── prisma/
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化数据库

```bash
npm run db:generate
npm run db:push
npm run db:seed
```

### 3. 安装前端依赖（可选，用于可视化测试）

```bash
cd web && npm install && cd ..
```

### 4. 启动服务

```bash
npm run dev
```

- **可视化测试页**：http://localhost:3000（Next.js，可对充值、下注、结算、取消、对账进行可视化调用）
- **后端 API**：http://localhost:3001（Express）

若只启动后端（不启动前端），可执行：`npm run dev:server`，此时 API 在 http://localhost:3001

### 5. 运行测试

```bash
npm test
```

## API 说明

### 用户系统

预置用户（seed 数据）：
- id=1: alice, balance=100
- id=2: bob, balance=200
- id=3: charlie, balance=50

不允许动态创建用户。

### 1. 充值

```
POST /api/users/:id/deposit
Header: Idempotency-Key: <string>
Body: { "amount": number }
```

- 增加用户余额
- 支持幂等性：相同 Idempotency-Key 只生效一次
- 相同 Key 但 amount 不同 → 409 Conflict

### 2. 下注

```
POST /api/bets
Header: Idempotency-Key: <string>
Body: { "userId": number, "gameId": string, "amount": number }
```

- 余额不足时返回 400
- 扣减余额，创建 Bet 和 Ledger 记录
- 支持幂等性

### 3. 结算

```
POST /api/bets/:id/settle
Body: { "result": "WIN" | "LOSE" }
```

- **WIN**: 退回本金 + 盈利（2x  payout）
- **LOSE**: 不返还
- 仅 PLACED 状态可结算
- 禁止重复结算

### 4. 取消

```
POST /api/bets/:id/cancel
```

- 仅 PLACED 状态可取消
- 退回余额，状态变为 CANCELLED

### 5. 对账

```
GET /api/admin/reconcile?userId=<number>
```

返回：
- 当前余额
- 账本计算余额
- 各状态订单统计
- 异常检测（重复结算、缺少退款、余额不一致）

## 数据库设计

### User
| 字段 | 类型 |
|------|------|
| id | Int (PK) |
| username | String (unique) |
| balance | Float |
| createdAt | DateTime |

### Bet
| 字段 | 类型 |
|------|------|
| id | Int (PK) |
| userId | Int (FK) |
| gameId | String |
| amount | Float |
| status | PLACED \| SETTLED \| CANCELLED |
| result | WIN \| LOSE (nullable) |
| createdAt | DateTime |
| updatedAt | DateTime |

### Ledger (Append-only)
| 字段 | 类型 |
|------|------|
| id | Int (PK) |
| userId | Int (FK) |
| type | DEPOSIT \| BET_DEBIT \| BET_CREDIT \| BET_REFUND |
| amount | Float |
| betId | Int (FK, nullable) |
| createdAt | DateTime |

### IdempotencyRecord
| 字段 | 类型 |
|------|------|
| id | Int (PK) |
| key | String (unique) |
| type | String |
| requestBody | String |
| responseStatus | Int |
| responseBody | String |
| createdAt | DateTime |

## 状态机

```
PLACED → SETTLED (结算)
PLACED → CANCELLED (取消)
SETTLED / CANCELLED 为终态
```

## 测试用例

1. 充值成功余额增加
2. 充值幂等性验证
3. 余额不足下注失败
4. 下注幂等性验证
5. 结算 WIN 增加余额
6. 已结算订单不允许重复结算

## 脚本命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 同时启动后端(3001) + 前端可视化(3000) |
| `npm run dev:server` | 仅启动后端 API (端口 3001) |
| `npm run dev:web` | 仅启动 Next 可视化测试页 (端口 3000) |
| `npm run build` | 构建后端 |
| `npm start` | 生产模式启动 |
| `npm test` | 运行测试 |
| `npm run db:generate` | 生成 Prisma Client |
| `npm run db:push` | 同步 schema 到数据库 |
| `npm run db:seed` | 执行 seed 数据 |
| `npm run db:reset` | 重置数据库 |
