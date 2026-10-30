'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';

export default function FloatingLogout() {
  const pathname = usePathname();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // 1. Strictly show ONLY on staff pages (/kitchen, /manager, /admin)
  const isStaffPage =
    pathname.startsWith('/kitchen') ||
    pathname.startsWith('/manager') ||
    pathname.startsWith('/admin');

  if (!isStaffPage) {
    return null;
  }

  const handleLogout = async () => {
    setLoading(true);
    try {
      // Terminate Supabase Auth session for staff
      await supabase.auth.signOut();
      router.push('/login?logout=success');
      router.refresh();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 left-6 z-50">
      <button
        onClick={handleLogout}
        disabled={loading}
        className="px-4 py-3 bg-gray-950/60 hover:bg-orange-600/90 text-gray-300 hover:text-white border border-gray-800/60 hover:border-orange-500/80 rounded-2xl shadow-xl backdrop-blur-md text-xs font-extrabold flex items-center gap-2 transition-all active:scale-95 cursor-pointer group opacity-80 hover:opacity-100"
        title="Sign Out"
      >
        <span className="text-sm group-hover:scale-110 transition-transform">🚪</span>
        <span className="hidden sm:inline">
          {loading ? 'Signing out...' : 'Sign Out'}
        </span>
      </button>
    </div>
  );
}