import { describe, expect, it } from 'vitest';
import { matchRoute } from './routes';

describe('matchRoute', () => {
  it('matches the four routes, with or without a trailing slash', () => {
    expect(matchRoute('/')).toBe('/');
    expect(matchRoute('/bench')).toBe('/bench');
    expect(matchRoute('/about/')).toBe('/about');
    expect(matchRoute('/settings')).toBe('/settings');
  });

  it('returns null for anything else', () => {
    expect(matchRoute('/nope')).toBeNull();
    expect(matchRoute('/toString')).toBeNull();
  });
});
