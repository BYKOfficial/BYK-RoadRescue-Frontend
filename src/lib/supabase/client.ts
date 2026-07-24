import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  // A warning, not a thrown error — a missing .env.local should degrade to
  // "requests fail with a clear network error" (see app/request/page.tsx's
  // try/catch), not crash the whole app at import time. Matches the rest of
  // this codebase's "never let a missing/late dependency blank the screen"
  // rule (see 01-ARCHITECTURE.md edge cases).
  console.warn(
    '[supabase] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are not set. ' +
      'Copy .env.local.example to .env.local and fill in your project values ' +
      '(Supabase dashboard -> Connect -> Framework -> Next.js), then restart `npm run dev`.'
  );
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseKey || 'placeholder-key'
);
