import { describe, expect, it } from 'vitest';
import { AskReplySchema, AskRequestSchema, MAX_IMAGE_BYTES, base64Bytes } from './index';

const b64 = (bytes: number) => btoa('\0'.repeat(bytes));
const image = btoa('not really a jpeg');

describe('AskRequestSchema', () => {
  it('round-trips a valid request', () => {
    const request = { image, hint: 'cup', detail: 0, voice: false, goals: ['oat milk'] };
    expect(AskRequestSchema.parse(JSON.parse(JSON.stringify(request)))).toEqual(request);
  });

  it('rejects a request without an image', () => {
    expect(AskRequestSchema.safeParse({ hint: 'cup', detail: 0, voice: false }).success).toBe(
      false,
    );
    expect(
      AskRequestSchema.safeParse({ image: '', hint: 'cup', detail: 0, voice: false }).success,
    ).toBe(false);
  });

  it('rejects an image over 300 KB', () => {
    const big = b64(MAX_IMAGE_BYTES + 1);
    expect(
      AskRequestSchema.safeParse({ image: big, hint: 'cup', detail: 0, voice: false }).success,
    ).toBe(false);
  });

  it('rejects a detail level outside 0 to 2 and more than 8 goals', () => {
    expect(AskRequestSchema.safeParse({ image, hint: '', detail: 3, voice: false }).success).toBe(
      false,
    );
    const goals = Array.from({ length: 9 }, (_, i) => `item ${i}`);
    expect(
      AskRequestSchema.safeParse({ image, hint: '', detail: 0, voice: false, goals }).success,
    ).toBe(false);
  });
});

describe('base64Bytes', () => {
  it('matches the decoded length for every padding case', () => {
    for (const n of [1, 2, 3, 4, 5, 300]) {
      expect(base64Bytes(b64(n))).toBe(n);
    }
  });
});

describe('AskReplySchema', () => {
  it('round-trips a reply and rejects an unknown confidence', () => {
    const reply = {
      label: 'Oat milk',
      sentence: 'Oat milk, one litre, unsweetened.',
      confidence: 'high',
      text_in_view: null,
    };
    expect(AskReplySchema.parse(reply)).toEqual(reply);
    expect(AskReplySchema.safeParse({ ...reply, confidence: 'certain' }).success).toBe(false);
  });
});
