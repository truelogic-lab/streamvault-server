import { prisma } from '../lib/prisma.js';

export async function getStats(_req, res) {
  const [movies, users, pendingSubs, activeSubs, genres] = await Promise.all([
    prisma.movie.count(),
    prisma.user.count(),
    prisma.subscription.count({ where: { status: 'PENDING' } }),
    prisma.subscription.count({ where: { status: 'ACTIVE' } }),
    prisma.genre.count(),
  ]);

  res.json({ movies, users, pendingSubs, activeSubs, genres });
}

export async function listUsers(req, res) {
  const take = Math.min(parseInt(req.query.take) || 50, 200);
  const skip = parseInt(req.query.skip) || 0;

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      take, skip,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, email: true, name: true, role: true, createdAt: true,
        subscription: {
          select: { status: true, plan: true, startedAt: true, expiresAt: true },
        },
      },
    }),
    prisma.user.count(),
  ]);

  res.json({ items, total });
}

export async function updateUserRole(req, res) {
  const { id } = req.params;
  const { role } = req.body;
  if (!['USER', 'ADMIN'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }
  const user = await prisma.user.update({
    where: { id },
    data: { role },
    select: { id: true, email: true, name: true, role: true },
  });
  res.json(user);
}

export async function updateSubscription(req, res) {
  const { userId } = req.params;
  const { status, plan, notes } = req.body;

  const allowed = ['PENDING', 'ACTIVE', 'SUSPENDED', 'EXPIRED'];
  if (status && !allowed.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const data = { status, plan, notes };
  if (status === 'ACTIVE') {
    data.startedAt = new Date();
    data.approvedBy = req.user.id;
  }

  const sub = await prisma.subscription.upsert({
    where: { userId },
    update: data,
    create: { userId, ...data, status: status || 'PENDING' },
  });

  res.json(sub);
}

export async function listGenres(_req, res) {
  const genres = await prisma.genre.findMany({ orderBy: { name: 'asc' } });
  res.json({ items: genres });
}
