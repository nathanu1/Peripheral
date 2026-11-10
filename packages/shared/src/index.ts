import { z } from 'zod';

/** Hard cap on the crop sent in an Ask (section 8). */
export const MAX_IMAGE_BYTES = 300 * 1024;
/** Long edge of the crop, in pixels. The client enforces this before encoding. */
export const MAX_IMAGE_EDGE = 768;
export const MAX_GOALS = 8;

/** Decoded size of a base64 string, without decoding it. */
export function base64Bytes(b64: string): number {
  const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - padding;
}

export const AskRequestSchema = z.object({
  /** Base64 JPEG, no data: prefix. */
  image: z
    .string()
    .min(1, 'An image is required.')
    .regex(/^[A-Za-z0-9+/]+={0,2}$/, 'The image must be base64.')
    .refine((s) => base64Bytes(s) <= MAX_IMAGE_BYTES, 'The image is larger than 300 KB.'),
  /** The detector's label for the crop. */
  hint: z.string().max(64),
  detail: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  voice: z.boolean(),
  goals: z.array(z.string().min(1).max(48)).max(MAX_GOALS).optional(),
});
export type AskRequest = z.infer<typeof AskRequestSchema>;

export const ConfidenceSchema = z.enum(['high', 'medium', 'low']);
export type Confidence = z.infer<typeof ConfidenceSchema>;

/** The structured reply Claude returns for one crop. Word limits live in the prompt. */
export const AskReplySchema = z.object({
  label: z.string(),
  sentence: z.string(),
  confidence: ConfidenceSchema,
  text_in_view: z.string().nullable(),
});
export type AskReply = z.infer<typeof AskReplySchema>;
