import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

const prisma = new PrismaClient();

const GENRES = [
  'Action','Adventure','Animation','Biography','Crime',
  'Comedy','Documentary','Drama','Family','Fantasy',
  'Horror','Mystery','Romance','Sci-Fi','Thriller',
];

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME || 'Owner';

  if (!email || !password) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env');
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.user.upsert({
    where: { email },
    update: { role: 'ADMIN' },
    create: { email, passwordHash, name, role: 'ADMIN' },
  });

  await prisma.subscription.upsert({
    where: { userId: admin.id },
    update: { status: 'ACTIVE', plan: 'owner' },
    create: { userId: admin.id, status: 'ACTIVE', plan: 'owner' },
  });

  for (const g of GENRES) {
    await prisma.genre.upsert({
      where: { name: g },
      update: {},
      create: { name: g },
    });
  }

  console.log('✔ Seed complete. Admin:', admin.email);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
