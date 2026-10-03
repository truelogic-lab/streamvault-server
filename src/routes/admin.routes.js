import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import {
  getStats, listUsers, updateUserRole,
  updateSubscription, listGenres,
} from '../controllers/admin.controller.js';

const router = Router();

router.use(requireAuth, requireAdmin);

router.get('/stats', getStats);
router.get('/users', listUsers);
router.put('/users/:id/role', updateUserRole);
router.put('/users/:userId/subscription', updateSubscription);
router.get('/genres', listGenres);

export default router;
