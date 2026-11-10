import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { composite, contrastRatio, parseColor } from './contrast';

const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');
const token = (name: string) => {
  const match = new RegExp(`--${name}:\\s*([^;]+);`).exec(css);
  if (!match?.[1]) throw new Error(`Missing token --${name}`);
  return match[1].trim();
};
const rgb = (name: string) => {
  const [r, g, b] = parseColor(token(name));
  return [r, g, b] as const;
};

const WHITE = [255, 255, 255] as const;
const BLACK = [0, 0, 0] as const;

describe('design tokens', () => {
  it('label text reaches 4.5:1 on the plate over the brightest and darkest frames', () => {
    for (const frame of [WHITE, BLACK]) {
      const plate = composite(parseColor(token('color-plate')), frame);
      expect(contrastRatio(rgb('color-ink'), plate)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('secondary text reaches 4.5:1 on the plate over a white frame', () => {
    const plate = composite(parseColor(token('color-plate')), WHITE);
    const ink2 = composite(parseColor(token('color-ink-2')), plate);
    expect(contrastRatio(ink2, plate)).toBeGreaterThanOrEqual(4.5);
  });

  it('status glyph colors reach 3:1 on the plate over a white frame', () => {
    const plate = composite(parseColor(token('color-plate')), WHITE);
    for (const name of [
      'color-relevant',
      'color-unsure',
      'color-hazard',
      'color-cloud',
      'color-dot',
    ]) {
      expect(contrastRatio(rgb(name), plate), name).toBeGreaterThanOrEqual(3);
    }
  });

  it('no text size is below 11px', () => {
    const sizes = [...css.matchAll(/--text-[a-z]+:\s*([\d.]+)rem/g)].map((m) => Number(m[1]) * 16);
    expect(sizes.length).toBeGreaterThan(0);
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(11);
  });
});
