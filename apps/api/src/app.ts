/** Express application instance – exported for testing. */
import express from 'express';
import { healthRouter } from './routes/health';
import { todoRouter } from './routes/todos';

const app = express();
app.use(express.json());

app.use(healthRouter);
app.use(todoRouter);

export default app;