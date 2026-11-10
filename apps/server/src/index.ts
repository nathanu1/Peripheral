import { serve } from '@hono/node-server';
import { createApp } from './app';

const port = Number(process.env.PORT ?? 8787);
const appOrigin = process.env.APP_ORIGIN ?? 'https://localhost:5173';

serve({ fetch: createApp({ appOrigin }).fetch, port }, (info) => {
  console.log(`  Peripheral server  http://localhost:${info.port}`);
});
