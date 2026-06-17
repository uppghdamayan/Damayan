'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { Spinner } from '@/components/ui/spinner';
import { PlusCircle, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { setUser, setAccessToken, setRequiresPasswordChange } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const supabase = createSupabaseClient();

  const handleLogin = async () => {
    setLoading(true);
    setError('');

    try {
      const authPromise = supabase.auth.signInWithPassword({ email, password });
      const timeoutPromise = new Promise<{ data: any; error: any }>((_, reject) => 
        setTimeout(() => reject(new Error('Connection timed out. Please try again.')), 15000)
      );

      const { data, error: authError } = await Promise.race([authPromise, timeoutPromise]);

      if (authError || !data?.session) {
        setError(authError?.message || 'Login failed. Check your credentials.');
        setLoading(false);
        return;
      }

      // Fetch user profile from the backend using the JWT
      const controller = new AbortController();
      const fetchTimeout = setTimeout(() => controller.abort(), 15000);

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${data.session.access_token}` },
        signal: controller.signal,
      });

      clearTimeout(fetchTimeout);

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
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setError('Connection timed out while fetching profile. Please try again.');
      } else {
        setError(err.message || 'An unexpected error occurred.');
      }
      await supabase.auth.signOut();
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center font-sans overflow-hidden">
      <div className="bg-surface border border-border rounded-card shadow-card px-9 py-10 w-full max-w-[400px]">
        {/* Logo + App name */}
        <div className="flex items-center gap-2 mb-7">
          <div className="w-[22px] h-[22px] bg-accent rounded-[5px] flex items-center justify-center flex-shrink-0">
            <PlusCircle size={12} color="white" strokeWidth={3} />
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
            disabled={loading}
            placeholder="you@damayan.ph"
            className="h-[34px] w-full px-2.5 bg-surface border border-border rounded-btn text-[13px] text-text-primary outline-none transition-all duration-150 focus:bg-surface focus:border-accent focus:shadow-accent-focus placeholder:text-text-muted disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-surface-2"
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
          <div className="relative w-full">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              placeholder="••••••••••••"
              onKeyDown={(e) => e.key === 'Enter' && !loading && handleLogin()}
              className="h-[34px] w-full px-2.5 pr-9 bg-surface border border-border rounded-btn text-[13px] text-text-primary outline-none transition-all duration-150 focus:bg-surface focus:border-accent focus:shadow-accent-focus placeholder:text-text-muted disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-surface-2"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors focus:outline-none w-5 h-5 flex items-center justify-center"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <EyeOff size={14} />
              ) : (
                <Eye size={14} />
              )}
            </button>
          </div>
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

