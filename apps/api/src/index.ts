/** API entry point – starts the HTTP server. */
import app from './app';

const port = Number(process.env.PORT) || 3001;

app.listen(port, () => {
  console.log(`API running on http://localhost:${port}`);
});
