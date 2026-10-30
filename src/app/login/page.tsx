'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import Link from 'next/link';

function LoginForm() {
  const [identifier, setIdentifier] = useState(''); // Holds email or name/username
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const searchParams = useSearchParams();
  const errorParam = searchParams.get('error');
  const router = useRouter();

  // Create client-side Supabase instance
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Map query parameter to clear explanation message
  const getErrorMessage = () => {
    if (errorParam === 'unauthorized') {
      return '🔒 Access Denied: You must be signed in with a valid staff account to access Kitchen, Manager, or Admin pages.';
    }
    if (errorParam === 'session_expired') {
      return '⏱️ Your session has expired. Please log in again to continue.';
    }
    return null;
  };

  const accessError = getErrorMessage();

  const handleStaffLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    let targetEmail = identifier.trim();

    // 1. Check if input is a name/username or an email
    const isEmail = targetEmail.includes('@');

    if (!isEmail) {
      // Look up email associated with username or full_name in public.profiles
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, email, username, full_name')
        .or(`username.ilike.${targetEmail},full_name.ilike.${targetEmail}`)
        .maybeSingle();

      if (profileError || !profileData || !profileData.email) {
        setError('No staff account found matching that name or username.');
        setLoading(false);
        return;
      }

      targetEmail = profileData.email;
    }

    // 2. Authenticate with Supabase Auth using target email & password
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: targetEmail,
      password,
    });

    if (authError) {
      setError('Invalid credentials. Please check your login details and password.');
      setLoading(false);
      return;
    }

    // 3. Fetch user role and redirect to designated page
    if (authData.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', authData.user.id)
        .single();

      const role = profile?.role || 'kitchen';

      if (role === 'admin') router.push('/admin');
      else if (role === 'manager') router.push('/manager');
      else router.push('/kitchen');

      router.refresh();
    }
  };

  return (
    <div className="max-w-md w-full space-y-6 relative z-10">
      {/* Brand Header */}
      <div className="text-center space-y-2">
        <Link
          href="/"
          className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-500 font-black text-xl mb-1 shadow-lg shadow-orange-500/10"
        >
          W
        </Link>
        <h1 className="text-2xl font-black uppercase tracking-tight text-white">
          WYAK <span className="text-orange-500">Resto Suite</span>
        </h1>
        <p className="text-xs text-gray-400 font-medium">
          Kitchen, Manager & Administrator Portal
        </p>
      </div>

      {/* Access Denied Warning Banner */}
      {accessError && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-start gap-3 text-amber-300 text-xs font-bold leading-relaxed shadow-lg">
          <span className="text-base shrink-0">⚠️</span>
          <div className="flex-1">
            <p className="font-extrabold uppercase text-[10px] text-amber-400 mb-0.5 tracking-wider">
              Authentication Required
            </p>
            <p>{accessError}</p>
          </div>
        </div>
      )}

      {/* Main Login Card */}
      <div className="bg-gray-900 border border-gray-800 rounded-3xl p-8 shadow-2xl backdrop-blur-md">
        {error && (
          <div className="mb-6 p-3.5 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 text-xs font-bold text-center flex items-center justify-center gap-2">
            <span>⚠️</span> {error}
          </div>
        )}

        <form onSubmit={handleStaffLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-extrabold text-gray-300 uppercase tracking-wider mb-1.5">
              Name or Email
            </label>
            <input
              type="text"
              placeholder="e.g. chef_douala or staff@wyak.local"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="w-full p-3.5 bg-gray-950 border border-gray-800 rounded-xl text-xs font-bold text-white placeholder:text-gray-600 focus:outline-none focus:border-orange-500 transition-colors"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-extrabold text-gray-300 uppercase tracking-wider mb-1.5">
              Password
            </label>
            <input
              type="password"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3.5 bg-gray-950 border border-gray-800 rounded-xl text-xs font-bold text-white placeholder:text-gray-600 focus:outline-none focus:border-orange-500 transition-colors"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-orange-600 hover:bg-orange-700 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-orange-600/25 transition-all active:scale-95 mt-2 cursor-pointer disabled:opacity-50"
          >
            {loading ? 'Authenticating...' : 'Sign In to Portal ➔'}
          </button>
        </form>
      </div>

      {/* Footer Back Link */}
      <div className="text-center">
        <Link
          href="/"
          className="text-xs text-gray-500 hover:text-gray-300 font-semibold transition-colors"
        >
          ← Back to Landing Page
        </Link>
      </div>
    </div>
  );
}

export default function StaffLoginPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col items-center justify-center p-6 relative selection:bg-orange-500 selection:text-black">
      {/* Background Glow Effect */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[250px] bg-orange-500/10 blur-[120px] rounded-full pointer-events-none" />

      <Suspense
        fallback={
          <div className="text-gray-400 text-xs font-bold flex items-center gap-2">
            <span className="animate-spin text-orange-500">⏳</span> Loading Auth Portal...
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}