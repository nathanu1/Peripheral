import { motion, useReducedMotion } from 'motion/react';
import { reduced, reveal } from '../design/motion';

/**
 * M0 skeleton. The camera, PrivacyDot and controls arrive in M1; for now this proves
 * that the tokens, Tailwind and the reveal spring are wired up end to end.
 */
export default function CameraRoute() {
  const preset = useReducedMotion() ? reduced : reveal;
  return (
    <main className="grid h-full place-items-center">
      <motion.div
        data-testid="label"
        className="bg-plate text-label rounded-plate px-3 py-2"
        initial={preset.initial}
        animate={preset.animate}
        transition={preset.transition}
      >
        <h1>Peripheral</h1>
      </motion.div>
    </main>
  );
}
