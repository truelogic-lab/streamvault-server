import { Router } from 'express';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';

const router = Router();
const execAsync = promisify(exec);

// One-time setup. Protected by SETUP_SECRET env var.
router.post('/bootstrap', async (req, res) => {
  const secret = req.headers['x-setup-secret'];
  if (!secret || secret !== process.env.SETUP_SECRET) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    // 1. Sync schema (creates all tables)
    const { stdout: pushOut, stderr: pushErr } = await execAsync(
      'npx prisma db push --skip-generate'
    );

    // 2. Seed admin + genres
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;
    const name = process.env.ADMIN_NAME || 'Owner';

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

    const GENRES = [
      'Action','Adventure','Animation','Biography','Crime',
      'Comedy','Documentary','Drama','Family','Fantasy',
      'Horror','Mystery','Romance','Sci-Fi','Thriller',
    ];
    for (const g of GENRES) {
      await prisma.genre.upsert({
        where: { name: g }, update: {}, create: { name: g },
      });
    }

    res.json({
      ok: true,
      pushStdout: pushOut?.split('\n').slice(-5).join('\n'),
      pushStderr: pushErr?.split('\n').slice(-5).join('\n'),
      admin: admin.email,
    });
  } catch (e) {
    console.error('[bootstrap]', e);
    res.status(500).json({ error: e.message });
  }
});

export default router;
