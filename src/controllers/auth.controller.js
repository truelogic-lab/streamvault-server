import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import {
  signAccess, signRefresh, verifyRefresh,
  cookieOptions,
} from '../lib/tokens.js';

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(2).max(80),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function issueTokens(res, user) {
  const access = signAccess(user);
  const refresh = signRefresh(user);
  res.cookie('access_token', access, { ...cookieOptions, maxAge: 15 * 60 * 1000 });
  res.cookie('refresh_token', refresh, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });
  return { access, refresh };
}

export async function register(req, res) {
  const { email, password, name } = req.body;

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return res.status(409).json({ error: 'Email already registered' });

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: {
      email, passwordHash, name,
      subscription: { create: { status: 'PENDING' } },
    },
    select: { id: true, email: true, name: true, role: true },
  });

  const tokens = issueTokens(res, user);
  res.status(201).json({ user, ...tokens });
}

export async function login(req, res) {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

  const safe = { id: user.id, email: user.email, name: user.name, role: user.role };
  const tokens = issueTokens(res, safe);
  res.json({ user: safe, ...tokens });
}

export async function refresh(req, res) {
  try {
    const token = req.cookies?.refresh_token || req.body?.refresh;
    if (!token) return res.status(401).json({ error: 'No refresh token' });

    const payload = verifyRefresh(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true, role: true },
    });
    if (!user) return res.status(401).json({ error: 'User not found' });

    const tokens = issueTokens(res, user);
    res.json({ user, ...tokens });
  } catch {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
}

export async function logout(_req, res) {
  res.clearCookie('access_token', cookieOptions);
  res.clearCookie('refresh_token', cookieOptions);
  res.json({ ok: true });
}

export async function me(req, res) {
  const sub = await prisma.subscription.findUnique({
    where: { userId: req.user.id },
  });
  res.json({ user: req.user, subscription: sub });
}
