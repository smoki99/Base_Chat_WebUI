/** Express application instance – exported for testing. */
import express, { type NextFunction, type Request, type Response } from 'express';
import { healthRouter } from './routes/health';
import { todoRouter } from './routes/todos';

const app = express();
app.use(express.json());

app.use(healthRouter);
app.use(todoRouter);

// 404 – unknown route returns ApiError shape
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: { message: 'Not found' } });
});

// Central error handler (4-arg = Express error middleware)
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  const status = (err as { status?: number }).status ?? 500;
  const message = status === 400 ? 'Invalid request body' : 'Internal server error';
  res.status(status).json({ error: { message } });
});

export default app;