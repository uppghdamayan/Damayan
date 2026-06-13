'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { apiRequest } from '@/lib/api';
import { createSupabaseClient } from '@/lib/supabase/client';

export default function ChangePasswordPage() {
  const router = useRouter();
  const { user, requiresPasswordChange, setRequiresPasswordChange, clear } = useAuthStore();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  // Guard: if no password change is required, redirect away
  useEffect(() => {
    if (user && !requiresPasswordChange) {
      if (user.role === 'ADMIN') {
        router.replace('/admin/accounts');
      } else {
        router.replace('/dashboard');
      }
    }
  }, [user, requiresPasswordChange, router]);

  const handleSignOut = async () => {
    const supabase = createSupabaseClient();
    await supabase.auth.signOut();
    clear();
    window.location.href = '/login';
  };

  const handleSubmit = async () => {
    setError('');

    if (!newPassword || !confirmPassword) {
      setError('Both fields are required.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (newPassword.length < 12) {
      setError('Password must be at least 12 characters long.');
      return;
    }

    const hasUpper = /[A-Z]/.test(newPassword);
    const hasLower = /[a-z]/.test(newPassword);
    const hasDigit = /\d/.test(newPassword);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword);

    if (!hasUpper || !hasLower || !hasDigit || !hasSpecial) {
      setError('Password must include uppercase, lowercase, digit, and special character.');
      return;
    }

    setLoading(true);

    try {
      await apiRequest('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ newPassword }),
      });

      setSuccess(true);

      // Brief success message, then redirect to login
      setTimeout(async () => {
        const supabase = createSupabaseClient();
        await supabase.auth.signOut();
        clear();
        window.location.href = '/login';
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to change password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Don't render until we know who the user is
  if (!user) return null;

  const inputStyle = {
    height: 34,
    width: '100%' as const,
    padding: '0 10px',
    background: '#FFFFFF',
    border: '1px solid #D1D5E0',
    borderRadius: 6,
    fontSize: 13,
    color: '#0D1117',
    outline: 'none' as const,
    boxSizing: 'border-box' as const,
    fontFamily: "'IBM Plex Sans', sans-serif",
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
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        {/* Card */}
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

          {/* User identity */}
          <div style={{ marginBottom: 20 }}>
            <h1 style={{ fontSize: 15, fontWeight: 700, color: '#0D1117', marginBottom: 4, margin: 0 }}>
              Change Temporary Password
            </h1>
            <p style={{ fontSize: 12, color: '#6B7280', margin: '4px 0 0' }}>
              {user.firstName} {user.lastName} · {user.email}
            </p>
          </div>

          {/* Explanation */}
          <div
            style={{
              background: '#FEF3C7',
              border: '1px solid #F59E0B',
              borderRadius: 6,
              padding: '10px 12px',
              marginBottom: 20,
            }}
          >
            <p style={{ fontSize: 11, color: '#92400E', margin: 0, lineHeight: 1.5 }}>
              Your account was provisioned with a temporary password. Set a permanent password to continue.
            </p>
          </div>

          {/* New Password */}
          <div style={{ marginBottom: 14 }}>
            <label
              htmlFor="new-password"
              style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 6 }}
            >
              New Password
            </label>
            <input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Min 12 chars, mixed case, digit, special"
              style={inputStyle}
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

          {/* Confirm Password */}
          <div style={{ marginBottom: 20 }}>
            <label
              htmlFor="confirm-password"
              style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 6 }}
            >
              Confirm Password
            </label>
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your new password"
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              style={inputStyle}
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

          {/* Password requirements hint */}
          <div style={{ marginBottom: 16, padding: '0 2px' }}>
            <p style={{ fontSize: 10, color: '#6B7280', margin: 0, lineHeight: 1.6 }}>
              Password requirements: at least 12 characters, one uppercase, one lowercase, one digit, one special character.
            </p>
          </div>

          {/* Error */}
          {error && (
            <p style={{ fontSize: 12, color: '#991B1B', marginBottom: 14 }}>
              {error}
            </p>
          )}

          {/* Success */}
          {success && (
            <p style={{ fontSize: 12, color: '#14532D', marginBottom: 14 }}>
              Password changed successfully. Redirecting to login…
            </p>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={loading || !newPassword || !confirmPassword}
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
              fontFamily: "'IBM Plex Sans', sans-serif",
            }}
          >
            {loading ? 'Changing Password…' : 'Set New Password'}
          </button>
        </div>

        {/* Sign Out button — below the card */}
        <button
          onClick={handleSignOut}
          style={{
            height: 28,
            padding: '0 16px',
            background: 'transparent',
            border: '1px solid #D1D5E0',
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 600,
            color: '#6B7280',
            cursor: 'pointer',
            fontFamily: "'IBM Plex Sans', sans-serif",
          }}
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
