import { describe, expect, it } from 'vitest';
import { createApp } from './app';

const app = createApp({ appOrigin: 'https://app.example' });
const post = (body: unknown) =>
  app.request('/api/ask', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('server', () => {
  it('answers the health check', async () => {
    const res = await app.request('/api/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('rejects an Ask without an image', async () => {
    const res = await post({ hint: 'cup', detail: 0, voice: false });
    expect(res.status).toBe(400);
  });

  it('allows only the app origin', async () => {
    const ok = await app.request('/api/health', { headers: { origin: 'https://app.example' } });
    expect(ok.headers.get('access-control-allow-origin')).toBe('https://app.example');
    const other = await app.request('/api/health', { headers: { origin: 'https://evil.example' } });
    expect(other.headers.get('access-control-allow-origin')).toBeNull();
  });
});
