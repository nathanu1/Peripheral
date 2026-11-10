import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { AskRequestSchema } from '@peripheral/shared';

export interface AppOptions {
  /** The web app's origin. CORS allows only this. */
  appOrigin: string;
}

export function createApp({ appOrigin }: AppOptions) {
  const app = new Hono();

  app.use('/api/*', cors({ origin: appOrigin, allowMethods: ['POST', 'GET'] }));

  app.get('/api/health', (c) => c.json({ ok: true }));

  // M0 stub. Validation is real; the Claude call, SSE and rate limit land in M4.
  app.post('/api/ask', async (c) => {
    const body: unknown = await c.req.json().catch(() => null);
    const parsed = AskRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request.' }, 400);
    }
    return c.json({ error: 'Ask is not available yet.' }, 501);
  });

  return app;
}
