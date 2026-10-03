import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import {
  listMovies, getMovie, createMovie, updateMovie, deleteMovie,
} from '../controllers/movie.controller.js';

const router = Router();

// Public
router.get('/', listMovies);
router.get('/:slug', getMovie);

// Admin
router.post('/', requireAuth, requireAdmin, createMovie);
router.put('/:id', requireAuth, requireAdmin, updateMovie);
router.delete('/:id', requireAuth, requireAdmin, deleteMovie);

export default router;
