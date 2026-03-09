import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.$transaction(async (tx) => {
    const users = [
      { id: 1, username: 'alice', balance: 100 },
      { id: 2, username: 'bob', balance: 200 },
      { id: 3, username: 'charlie', balance: 50 },
    ];

    for (const u of users) {
      await tx.user.upsert({
        where: { id: u.id },
        update: {},
        create: {
          id: u.id,
          username: u.username,
          balance: u.balance,
        },
      });
      await tx.ledger.create({
        data: {
          userId: u.id,
          type: 'DEPOSIT',
          amount: u.balance,
        },
      });
    }
  });

  console.log('Seed completed: 3 users created (alice, bob, charlie) with initial ledger entries');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
