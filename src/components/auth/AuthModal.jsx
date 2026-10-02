import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from '../common/Modal';
import Button from '../common/Button';
import LoginForm from './LoginForm';
import SignUpForm from './SignUpForm';
import { useUser } from '../../context/UserContext';
import { Mail, Sparkles } from 'lucide-react';
import leenkitIcon from '../../assets/Leenkit icon.png';
import { EMAIL_CONFIRMATION_NOTICE } from '../../data/legal';

export default function AuthModal({ isOpen, onClose, initialView = 'welcome' }) {
  const { loginWithGoogle, loginWithEmail, registerWithEmail } = useUser();
  const navigate = useNavigate();
  const [view, setView] = useState(initialView); // 'welcome', 'login', 'signup'
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authNotice, setAuthNotice] = useState('');

  // Open on the requested view every time, with no stale errors.
  useEffect(() => {
    if (isOpen) {
      setView(initialView);
      setAuthError('');
      setAuthNotice('');
      setIsLoading(false);
    }
  }, [isOpen, initialView]);

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setAuthError('');
    try {
      await loginWithGoogle();
      onClose();
    } catch (e) {
      setAuthError(e.message || "Failed to sign in with Google.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailLogin = async ({ email, password }) => {
    setIsLoading(true);
    setAuthError('');
    try {
      await loginWithEmail(email, password);
      onClose();
    } catch (e) {
      setAuthError(e.message || "Failed to sign in.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailSignUp = async ({ name, email, password, avatar, acceptedLegal }) => {
    setIsLoading(true);
    setAuthError('');
    try {
      const result = await registerWithEmail({ name, email, password, avatar, acceptedLegal });
      if (result?.needsEmailConfirmation) {
        setAuthNotice(EMAIL_CONFIRMATION_NOTICE);
        setView('login');
        return;
      }
      onClose();
      navigate('/onboarding');
    } catch (e) {
      setAuthError(e.message || "Failed to create account.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="space-y-6 text-center pt-2">
        {/* Header Branding */}
        <div className="space-y-3">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl mx-auto shadow-xl shadow-black/10 border border-[#DDE3E0] bg-white overflow-hidden flex items-center justify-center">
            <img
              src={leenkitIcon}
              alt="LEENKIT Logo Icon"
              className="w-full h-full object-cover scale-[2.2]"
            />
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold font-heading text-[#172121]">
            Welcome to LEEN<span className="text-[#18A999]">KIT</span>
          </h2>
          <p className="text-xs text-[#3D4948] max-w-xs mx-auto">
            Find your people. Find something to do anywhere in the world.
          </p>
        </div>

        {/* View Switcher */}
        {view === 'welcome' && (
          <div className="space-y-3 pt-2">
            {/* Google OAuth Button */}
            <button
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="pressable w-full py-3 px-4 bg-white border border-[#DDE3E0] hover:bg-[#EEF1EF] hover:border-[#18A999]/30 rounded-full text-xs font-semibold text-[#172121] flex items-center justify-center gap-3 transition-all shadow-xs cursor-pointer disabled:opacity-50"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              <span>Continue with Google</span>
            </button>

            {/* Email Button */}
            <button
              onClick={() => setView('signup')}
              className="pressable w-full py-3 px-4 bg-[#172121] hover:bg-[#3D4948] text-white rounded-full text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer"
            >
              <Mail className="w-4 h-4 text-[#18A999]" />
              <span>Continue with Email</span>
            </button>

            <p className="text-[11px] text-[#3D4948] leading-relaxed px-2">
              New accounts must agree to the{' '}
              <a href="/terms" target="_blank" rel="noopener noreferrer" className="font-semibold text-[#087F73] underline underline-offset-2 hover:text-[#18A999]">
                Terms &amp; Conditions
              </a>{' '}
              and{' '}
              <a href="/privacy" target="_blank" rel="noopener noreferrer" className="font-semibold text-[#087F73] underline underline-offset-2 hover:text-[#18A999]">
                Privacy Policy
              </a>{' '}
              before using LEENKIT.
            </p>

            <div className="pt-4 border-t border-[#DDE3E0] text-xs text-[#3D4948]">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => setView('login')}
                className="text-[#18A999] font-bold hover:underline cursor-pointer"
              >
                Sign in
              </button>
            </div>
          </div>
        )}

        {authNotice && view === 'login' && (
          <div role="status" className="p-3 bg-[#DDF4EF] border border-[#18A999]/30 rounded-2xl text-xs font-medium text-[#087F73] text-left">
            {authNotice}
          </div>
        )}

        {view === 'login' && (
          <div className="text-left">
            <LoginForm
              onSubmit={handleEmailLogin}
              onToggleSignUp={() => setView('signup')}
              isLoading={isLoading}
              error={authError}
            />
          </div>
        )}

        {view === 'signup' && (
          <div className="text-left">
            <SignUpForm
              onSubmit={handleEmailSignUp}
              onToggleSignIn={() => setView('login')}
              isLoading={isLoading}
              error={authError}
            />
          </div>
        )}
      </div>
    </Modal>
  );
}
