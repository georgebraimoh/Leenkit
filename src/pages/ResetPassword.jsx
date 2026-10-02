import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import PageTransition from '../components/layout/PageTransition';
import FormField from '../components/common/FormField';
import Button from '../components/common/Button';
import { Lock, Eye, EyeOff, AlertCircle, CheckCircle2, KeyRound } from 'lucide-react';
import { authService } from '../services/auth/authService';
import { supabase } from '../lib/supabase';
import { useUser } from '../context/UserContext';

export default function ResetPassword() {
  const navigate = useNavigate();
  const { openAuthModal } = useUser();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [hasRecoverySession, setHasRecoverySession] = useState(true);

  useEffect(() => {
    let mounted = true;

    // Listen for PASSWORD_RECOVERY event or active session
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      if (event === 'PASSWORD_RECOVERY' || session) {
        setHasRecoverySession(true);
      }
    });

    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      if (session) {
        setHasRecoverySession(true);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!newPassword || !confirmPassword) {
      setErrorMessage('Please fill in all password fields.');
      return;
    }

    if (newPassword.length < 8) {
      setErrorMessage('Password must be at least 8 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please re-enter.');
      return;
    }

    setIsLoading(true);
    try {
      await authService.updatePassword(newPassword);
      setSuccessMessage('Your password has been updated successfully!');
    } catch (err) {
      setErrorMessage(err.message || 'Failed to update password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReturnToLogin = () => {
    navigate('/login');
    openAuthModal('login');
  };

  return (
    <PageTransition>
      <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full bg-white border border-[#DDE3E0] rounded-3xl p-8 shadow-xl space-y-6">
          {/* Header Branding */}
          <div className="text-center space-y-2">
            <Link to="/" className="inline-flex items-center gap-2 group">
              <div className="w-10 h-10 rounded-2xl bg-[#18A999] flex items-center justify-center text-white font-heading font-extrabold text-xl shadow-md">
                L
              </div>
            </Link>
            <h1 className="text-2xl font-bold font-heading text-[#172121]">
              Reset Your Password
            </h1>
            <p className="text-xs text-[#3D4948]">
              Enter a new secure password for your LEENKIT account.
            </p>
          </div>

          {/* Success State */}
          {successMessage ? (
            <div className="space-y-6 text-center py-2">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-medium text-emerald-800 space-y-2">
                <div className="flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span className="font-bold text-sm">Success!</span>
                </div>
                <p>{successMessage}</p>
              </div>

              <Button
                variant="primary"
                size="lg"
                fullWidth
                onClick={handleReturnToLogin}
              >
                Return to sign in
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-medium text-rose-600 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {!hasRecoverySession && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs font-medium text-amber-800 flex items-center gap-2">
                  <KeyRound className="w-4 h-4 shrink-0 text-amber-600" />
                  <span>
                    No active reset token found. Please ensure you opened the link from your password reset email.
                  </span>
                </div>
              )}

              <FormField label="New Password" required helpText="At least 6 characters.">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#6F6F6F]">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      if (errorMessage) setErrorMessage('');
                    }}
                    placeholder="Enter new password"
                    disabled={isLoading}
                    className="w-full pl-10 pr-10 py-3 bg-[#EEF1EF] border border-[#DDE3E0] rounded-2xl text-sm focus:outline-none focus:bg-white focus:border-[#18A999] disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#6F6F6F] hover:text-[#171717] cursor-pointer"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </FormField>

              <FormField label="Confirm New Password" required>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#6F6F6F]">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (errorMessage) setErrorMessage('');
                    }}
                    placeholder="Confirm new password"
                    disabled={isLoading}
                    className="w-full pl-10 pr-10 py-3 bg-[#EEF1EF] border border-[#DDE3E0] rounded-2xl text-sm focus:outline-none focus:bg-white focus:border-[#18A999] disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#6F6F6F] hover:text-[#171717] cursor-pointer"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </FormField>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                fullWidth
                disabled={isLoading || !newPassword || !confirmPassword || newPassword.length < 8}
                className="mt-2"
              >
                {isLoading ? 'Updating password...' : 'Update Password'}
              </Button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={handleReturnToLogin}
                  className="text-xs text-[#6F6F6F] hover:text-[#18A999] font-semibold cursor-pointer transition-colors"
                >
                  Return to sign in
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </PageTransition>
  );
}
