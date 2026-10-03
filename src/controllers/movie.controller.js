import { z } from 'zod';
import { prisma } from '../lib/prisma.js';

const listQuerySchema = z.object({
  q: z.string().optional(),
  genre: z.string().optional(),
  type: z.enum(['MOVIE', 'SERIES']).optional(),
  trending: z.enum(['true', 'false']).optional(),
  featured: z.enum(['true', 'false']).optional(),
  take: z.coerce.number().min(1).max(100).default(40),
  skip: z.coerce.number().min(0).default(0),
});

const upsertSchema = z.object({
  title: z.string().min(1).max(200),
  slug: z.string().min(1).max(200).optional(),
  description: z.string().max(4000).optional(),
  tagline: z.string().max(300).optional(),
  year: z.number().int().min(1888).max(2100).optional(),
  duration: z.string().max(40).optional(),
  rating: z.number().min(0).max(10).optional(),
  type: z.enum(['MOVIE', 'SERIES']).default('MOVIE'),
  posterUrl: z.string().url().optional(),
  backdropUrl: z.string().url().optional(),
  trailerUrl: z.string().url().optional(),
  videoId: z.string().optional(),
  videoStatus: z.string().optional(),
  videoDuration: z.number().int().optional(),
  featured: z.boolean().optional(),
  trending: z.boolean().optional(),
  published: z.boolean().optional(),
  genres: z.array(z.string()).optional(),
});

function slugify(input) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export async function listMovies(req, res) {
  const { q, genre, type, trending, featured, take, skip } = listQuerySchema.parse(req.query);

  const where = { published: true };
  if (q) where.title = { contains: q, mode: 'insensitive' };
  if (type) where.type = type;
  if (trending === 'true') where.trending = true;
  if (featured === 'true') where.featured = true;
  if (genre) where.genres = { some: { name: genre } };

  const [items, total] = await Promise.all([
    prisma.movie.findMany({
      where,
      take, skip,
      orderBy: { createdAt: 'desc' },
      include: { genres: { select: { name: true } } },
    }),
    prisma.movie.count({ where }),
  ]);

  res.json({ items: items.map(shape), total });
}

export async function getMovie(req, res) {
  const movie = await prisma.movie.findUnique({
    where: { slug: req.params.slug },
    include: { genres: { select: { name: true } } },
  });
  if (!movie || !movie.published) return res.status(404).json({ error: 'Not found' });
  res.json(shape(movie));
}

export async function createMovie(req, res) {
  const data = upsertSchema.parse(req.body);
  const slug = data.slug || slugify(data.title);

  const movie = await prisma.movie.create({
    data: {
      slug,
      title: data.title,
      description: data.description,
      tagline: data.tagline,
      year: data.year,
      duration: data.duration,
      rating: data.rating,
      type: data.type,
      posterUrl: data.posterUrl,
      backdropUrl: data.backdropUrl,
      trailerUrl: data.trailerUrl,
      videoId: data.videoId,
      videoStatus: data.videoStatus,
      videoDuration: data.videoDuration,
      featured: data.featured ?? false,
      trending: data.trending ?? false,
      published: data.published ?? true,
      genres: data.genres
        ? { connectOrCreate: data.genres.map((name) => ({ where: { name }, create: { name } })) }
        : undefined,
    },
    include: { genres: { select: { name: true } } },
  });

  res.status(201).json(shape(movie));
}

export async function updateMovie(req, res) {
  const { id } = req.params;
  const data = upsertSchema.partial().parse(req.body);

  const movie = await prisma.movie.update({
    where: { id },
    data: {
      ...data,
      genres: data.genres
        ? { set: [], connectOrCreate: data.genres.map((name) => ({ where: { name }, create: { name } })) }
        : undefined,
    },
    include: { genres: { select: { name: true } } },
  });

  res.json(shape(movie));
}

export async function deleteMovie(req, res) {
  await prisma.movie.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
}

function shape(m) {
  return {
    id: m.id,
    slug: m.slug,
    title: m.title,
    description: m.description,
    tagline: m.tagline,
    year: m.year,
    duration: m.duration,
    rating: m.rating,
    type: m.type,
    poster: m.posterUrl,
    backdrop: m.backdropUrl,
    trailer: m.trailerUrl,
    videoId: m.videoId,
    videoStatus: m.videoStatus,
    featured: m.featured,
    trending: m.trending,
    genres: m.genres?.map((g) => g.name) ?? [],
  };
}
