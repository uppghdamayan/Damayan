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
    <div
      style={{
        minHeight: '100vh',
        background: '#F0F2F5',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'IBM Plex Sans', sans-serif",
      }}
    >
      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid #D1D5E0',
          borderRadius: 8,
          boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
          padding: '40px 36px',
          width: '100%',
          maxWidth: 400,
        }}
      >
        {/* Logo + App name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
          <div
            style={{
              width: 32,
              height: 32,
              background: '#0A6E5F',
              borderRadius: 6,
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: 18, fontWeight: 700, color: '#0D1117', letterSpacing: '-0.3px' }}>
            DAMAYAN
          </span>
        </div>

        <h1 style={{ fontSize: 15, fontWeight: 700, color: '#0D1117', marginBottom: 4 }}>
          Sign in to your account
        </h1>
        <p style={{ fontSize: 12, color: '#6B7280', marginBottom: 24 }}>
          Use the credentials provided by your administrator.
        </p>

        {/* Email field */}
        <div style={{ marginBottom: 14 }}>
          <label
            htmlFor="email"
            style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 6 }}
          >
            Email address
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@damayan.ph"
            style={{
              height: 34,
              width: '100%',
              padding: '0 10px',
              background: '#FFFFFF',
              border: '1px solid #D1D5E0',
              borderRadius: 6,
              fontSize: 13,
              color: '#0D1117',
              outline: 'none',
              boxSizing: 'border-box',
            }}
            onFocus={(e) => {
              e.target.style.borderColor = '#0A6E5F';
              e.target.style.boxShadow = '0 0 0 3px rgba(10,110,95,0.12)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = '#D1D5E0';
              e.target.style.boxShadow = 'none';
            }}
          />
        </div>

        {/* Password field */}
        <div style={{ marginBottom: 20 }}>
          <label
            htmlFor="password"
            style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 6 }}
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
            style={{
              height: 34,
              width: '100%',
              padding: '0 10px',
              background: '#FFFFFF',
              border: '1px solid #D1D5E0',
              borderRadius: 6,
              fontSize: 13,
              color: '#0D1117',
              outline: 'none',
              boxSizing: 'border-box',
            }}
            onFocus={(e) => {
              e.target.style.borderColor = '#0A6E5F';
              e.target.style.boxShadow = '0 0 0 3px rgba(10,110,95,0.12)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = '#D1D5E0';
              e.target.style.boxShadow = 'none';
            }}
          />
        </div>

        {/* Error message */}
        {error && (
          <p style={{ fontSize: 12, color: '#991B1B', marginBottom: 14 }}>
            {error}
          </p>
        )}

        {/* Submit button */}
        <button
          onClick={handleLogin}
          disabled={loading || !email || !password}
          style={{
            height: 34,
            width: '100%',
            background: loading ? '#085A4E' : '#0A6E5F',
            color: '#FFFFFF',
            border: '1px solid #085A4E',
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            boxShadow: '0 2px 4px rgba(10,110,95,0.15)',
            transition: 'background 0.15s',
          }}
        >
          {loading ? 'Signing in…' : 'Sign In'}
        </button>

        <p style={{ marginTop: 20, fontSize: 11, color: '#6B7280', textAlign: 'center' }}>
          Accounts are provisioned by your system administrator.
        </p>
      </div>
    </div>
  );
}
