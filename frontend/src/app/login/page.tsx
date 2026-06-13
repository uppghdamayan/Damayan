'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/authStore';

export default function LoginPage() {
  const router = useRouter();
  const { setUser, setAccessToken, setRequiresPasswordChange } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const supabase = createSupabaseClient();

  const handleLogin = async () => {
    setLoading(true);
    setError('');

    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError || !data.session) {
      setError(authError?.message || 'Login failed. Check your credentials.');
      setLoading(false);
      return;
    }

    // Fetch user profile from the backend using the JWT
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${data.session.access_token}` },
    });

    if (!res.ok) {
      setError('Account is inactive or not found. Contact your administrator.');
      await supabase.auth.signOut();
      setLoading(false);
      return;
    }

    const profile = await res.json();
    setUser(profile);
    setAccessToken(data.session.access_token);
    setRequiresPasswordChange(profile.requiresPasswordChange);

    // Route: password change required → admin → doctor/nurse dashboard
    if (profile.requiresPasswordChange) {
      router.replace('/change-password');
    } else if (profile.role === 'ADMIN') {
      router.replace('/admin/accounts');
    } else {
      router.replace('/dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-[#F0F2F5] flex items-center justify-center font-sans">
      <div className="bg-white border border-[#D1D5E0] rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.05)] px-9 py-10 w-full max-w-[400px]">
        {/* Logo + App name */}
        <div className="flex items-center gap-2.5 mb-7">
          <div className="w-8 h-8 bg-[#0A6E5F] rounded-md shrink-0" />
          <span className="text-lg font-bold text-[#0D1117] tracking-[-0.3px]">
            DAMAYAN
          </span>
        </div>

        <h1 className="text-[15px] font-bold text-[#0D1117] mb-1">
          Sign in to your account
        </h1>
        <p className="text-xs text-[#6B7280] mb-6">
          Use the credentials provided by your administrator.
        </p>

        {/* Email field */}
        <div className="mb-3.5">
          <label
            htmlFor="email"
            className="block text-[11px] font-semibold text-[#374151] mb-1.5"
          >
            Email address
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@damayan.ph"
            className="h-[34px] w-full px-2.5 bg-white border border-[#D1D5E0] rounded-md text-[13px] text-[#0D1117] outline-none box-border focus:border-[#0A6E5F] focus:ring-[3px] focus:ring-[#0A6E5F]/12 transition-all"
          />
        </div>

        {/* Password field */}
        <div className="mb-5">
          <label
            htmlFor="password"
            className="block text-[11px] font-semibold text-[#374151] mb-1.5"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••••••"
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            className="h-[34px] w-full px-2.5 bg-white border border-[#D1D5E0] rounded-md text-[13px] text-[#0D1117] outline-none box-border focus:border-[#0A6E5F] focus:ring-[3px] focus:ring-[#0A6E5F]/12 transition-all"
          />
        </div>

        {/* Error message */}
        {error && (
          <p className="text-xs text-[#991B1B] mb-3.5">
            {error}
          </p>
        )}

        {/* Submit button */}
        <button
          onClick={handleLogin}
          disabled={loading || !email || !password}
          className={`h-[34px] w-full text-white border border-[#085A4E] rounded-md text-[11px] font-semibold shadow-[0_2px_4px_rgba(10,110,95,0.15)] transition-colors duration-150 ${loading ? 'bg-[#085A4E] cursor-not-allowed' : 'bg-[#0A6E5F] cursor-pointer hover:bg-[#085A4E]'}`}
        >
          {loading ? 'Signing in…' : 'Sign In'}
        </button>

        <p className="mt-5 text-[11px] text-[#6B7280] text-center">
          Accounts are provisioned by your system administrator.
        </p>
      </div>
    </div>
  );
}
