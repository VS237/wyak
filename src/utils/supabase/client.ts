// utils/supabase/client.ts (or src/utils/supabase/client.ts)
import { createBrowserClient } from '@supabase/ssr';
import { Database } from '@/types/database'; // Optional if you have custom database types

export function createClient() {
  return createBrowserClient<any>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}