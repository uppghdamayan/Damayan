'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { apiRequest } from '@/lib/api';
import { createSupabaseClient } from '@/lib/supabase/client';
import { Eye, EyeOff } from 'lucide-react';

export default function ChangePasswordPage() {
  const router = useRouter();
  const { user, requiresPasswordChange, setRequiresPasswordChange, clear } = useAuthStore();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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

  const inputClassName = "h-[34px] w-full px-2.5 pr-9 bg-white border border-[#D1D5E0] rounded-md text-[13px] text-[#0D1117] outline-none box-border focus:border-[#0A6E5F] focus:ring-[3px] focus:ring-[#0A6E5F]/12 transition-all font-sans";

  return (
    <div className="min-h-screen bg-[#F0F2F5] flex items-center justify-center font-sans">
      <div className="flex flex-col items-center gap-4">
        {/* Card */}
        <div className="bg-white border border-[#D1D5E0] rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.05)] px-9 py-10 w-full max-w-[400px]">
          {/* Logo + App name */}
          <div className="flex items-center gap-2.5 mb-7">
            <div className="w-8 h-8 bg-[#0A6E5F] rounded-md shrink-0" />
            <span className="text-lg font-bold text-[#0D1117] tracking-[-0.3px]">
              DAMAYAN
            </span>
          </div>

          {/* User identity */}
          <div className="mb-5">
            <h1 className="text-[15px] font-bold text-[#0D1117] mb-1 mt-0">
              Change Temporary Password
            </h1>
            <p className="text-xs text-[#6B7280] mt-1 mb-0">
              {user.firstName} {user.lastName} · {user.email}
            </p>
          </div>

          {/* Explanation */}
          <div className="bg-[#FEF3C7] border border-[#F59E0B] rounded-md px-3 py-2.5 mb-5">
            <p className="text-[11px] text-[#92400E] m-0 leading-relaxed">
              Your account was provisioned with a temporary password. Set a permanent password to continue.
            </p>
          </div>

          {/* New Password */}
          <div className="mb-3.5">
            <label
              htmlFor="new-password"
              className="block text-[11px] font-semibold text-[#374151] mb-1.5"
            >
              New Password
            </label>
            <div className="relative w-full">
              <input
                id="new-password"
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min 12 chars, mixed case, digit, special"
                className={inputClassName}
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#0D1117] transition-colors focus:outline-none w-5 h-5 flex items-center justify-center"
                aria-label={showNewPassword ? 'Hide password' : 'Show password'}
              >
                {showNewPassword ? (
                  <EyeOff size={14} />
                ) : (
                  <Eye size={14} />
                )}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div className="mb-5">
            <label
              htmlFor="confirm-password"
              className="block text-[11px] font-semibold text-[#374151] mb-1.5"
            >
              Confirm Password
            </label>
            <div className="relative w-full">
              <input
                id="confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your new password"
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                className={inputClassName}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#0D1117] transition-colors focus:outline-none w-5 h-5 flex items-center justify-center"
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                {showConfirmPassword ? (
                  <EyeOff size={14} />
                ) : (
                  <Eye size={14} />
                )}
              </button>
            </div>
          </div>

          {/* Password requirements hint */}
          <div className="mb-4 px-0.5">
            <p className="text-[10px] text-[#6B7280] m-0 leading-relaxed">
              Password requirements: at least 12 characters, one uppercase, one lowercase, one digit, one special character.
            </p>
          </div>

          {/* Error */}
          {error && (
            <p className="text-xs text-[#991B1B] mb-3.5">
              {error}
            </p>
          )}

          {/* Success */}
          {success && (
            <p className="text-xs text-[#14532D] mb-3.5">
              Password changed successfully. Redirecting to login…
            </p>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={loading || !newPassword || !confirmPassword}
            className={`h-[34px] w-full text-white border border-[#085A4E] rounded-md text-[11px] font-semibold shadow-[0_2px_4px_rgba(10,110,95,0.15)] transition-colors duration-150 font-sans ${loading ? 'bg-[#085A4E] cursor-not-allowed' : 'bg-[#0A6E5F] cursor-pointer hover:bg-[#085A4E]'}`}
          >
            {loading ? 'Changing Password…' : 'Set New Password'}
          </button>
        </div>

        {/* Sign Out button — below the card */}
        <button
          onClick={handleSignOut}
          className="h-7 px-4 bg-transparent border border-[#D1D5E0] rounded-md text-[11px] font-semibold text-[#6B7280] cursor-pointer font-sans hover:bg-[#F7F8FA]"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
