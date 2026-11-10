/**
 * Motion presets (brief, section 6). Every component animation uses one of these.
 * Springs follow Apple's model: a visual duration and a bounce.
 */
import type { Transition } from 'motion/react';

/** Label and card enter: the plate materializes in place. It never slides. */
export const reveal = {
  transition: { type: 'spring', visualDuration: 0.35, bounce: 0 } satisfies Transition,
  initial: { opacity: 0, scale: 0.96, filter: 'blur(6px)' },
  animate: { opacity: 1, scale: 1, filter: 'blur(0px)' },
} as const;

/** Hysteresis moves of an already-placed label. */
export const move = {
  transition: { type: 'spring', visualDuration: 0.4, bounce: 0 } satisfies Transition,
} as const;

export const dismiss = {
  transition: { duration: 0.2, ease: 'easeOut' } satisfies Transition,
  exit: { opacity: 0, scale: 0.98 },
} as const;

/** The armed ring is a progress indicator, so it is linear. */
export const armed = {
  durationMs: 400,
  transition: { duration: 0.4, ease: 'linear' } satisfies Transition,
} as const;

/** Focus-mode dim sweep. Driven by a GSAP timeline on the shader uniform, not by Motion. */
export const focusDim = { from: 0, to: 0.5, duration: 0.6, ease: 'power2.out' } as const;

/** prefers-reduced-motion: everything becomes a 150 ms cross-fade. No scale, blur or sweep. */
export const reduced = {
  transition: { duration: 0.15, ease: 'linear' } satisfies Transition,
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
} as const;

/** Auto-dismiss after this long with no interaction (policy rule 6). */
export const IDLE_DISMISS_MS = 8000;
/** A better label position must hold this long before the label moves (policy rule 3). */
export const HYSTERESIS_MS = 500;
