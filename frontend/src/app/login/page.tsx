'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { Spinner } from '@/components/ui/spinner';

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
    <div className="min-h-screen bg-bg flex items-center justify-center font-sans overflow-hidden">
      <div className="bg-surface border border-border rounded-card shadow-card px-9 py-10 w-full max-w-[400px]">
        {/* Logo + App name */}
        <div className="flex items-center gap-2 mb-7">
          <div className="w-[22px] h-[22px] bg-accent rounded-[5px] flex items-center justify-center flex-shrink-0">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3C7.02944 3 3 7.02944 3 12C3 16.9706 7.02944 21 12 21Z" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12 8V16" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M8 12H16" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="text-[16px] font-bold tracking-[0.5px] whitespace-nowrap text-text-primary">
            DAMAYAN <small className="text-[9px] font-semibold text-text-muted tracking-[1px] uppercase mt-[3px]">EMR</small>
          </span>
        </div>

        <h1 className="text-[15px] font-bold text-text-primary mb-1">
          Sign in to your account
        </h1>
        <p className="text-[12px] text-text-muted mb-6">
          Use the credentials provided by your administrator.
        </p>

        {/* Email field */}
        <div className="mb-3.5 flex flex-col">
          <label
            htmlFor="email"
            className="text-[11px] font-semibold text-text-secondary uppercase tracking-[0.5px] mb-1.5"
          >
            Email address
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@damayan.ph"
            className="h-[34px] w-full px-2.5 bg-surface border border-border rounded-btn text-[13px] text-text-primary outline-none transition-all duration-150 focus:bg-surface focus:border-accent focus:shadow-accent-focus placeholder:text-text-muted"
          />
        </div>

        {/* Password field */}
        <div className="mb-5 flex flex-col">
          <label
            htmlFor="password"
            className="text-[11px] font-semibold text-text-secondary uppercase tracking-[0.5px] mb-1.5"
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
            className="h-[34px] w-full px-2.5 bg-surface border border-border rounded-btn text-[13px] text-text-primary outline-none transition-all duration-150 focus:bg-surface focus:border-accent focus:shadow-accent-focus placeholder:text-text-muted"
          />
        </div>

        {/* Error message */}
        {error && (
          <p className="text-[12px] text-red font-semibold mb-3.5">
            {error}
          </p>
        )}

        {/* Submit button */}
        <button
          onClick={handleLogin}
          disabled={loading || !email || !password}
          className={`h-[34px] w-full text-white border border-accent-hover rounded-btn text-[11px] font-semibold shadow-btn-primary transition-all duration-150 flex items-center justify-center gap-2 ${loading ? 'bg-accent-hover cursor-not-allowed' : 'bg-accent cursor-pointer hover:bg-accent-hover hover:shadow-btn-primary-hover'}`}
        >
          {loading ? (
            <>
              <Spinner size="sm" className="text-white" />
              <span>Signing in…</span>
            </>
          ) : (
            'Sign In'
          )}
        </button>

        <p className="mt-5 text-[11px] text-text-muted text-center">
          Accounts are provisioned by your system administrator.
        </p>
      </div>
    </div>
  );
}

