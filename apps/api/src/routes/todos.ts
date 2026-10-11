import { Router } from 'express';
import { getTodos } from '../services/todoService';

const router = Router();

/** GET /api/todos – list all todos. */
router.get('/api/todos', (_req, res) => {
  const todos = getTodos();
  res.json({ data: todos });
});

export { router as todoRouter };