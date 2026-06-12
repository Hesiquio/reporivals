import app from './src/index';

const port = parseInt(process.env.PORT || '3000', 10);
console.log(`[Local] Hono server started on port ${port}`);

Bun.serve({
  port,
  fetch: app.fetch,
});
