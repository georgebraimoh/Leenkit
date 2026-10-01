import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import PageTransition from '../components/layout/PageTransition';
import LoginForm from '../components/auth/LoginForm';
import SignUpForm from '../components/auth/SignUpForm';
import { useUser } from '../context/UserContext';
import { EMAIL_CONFIRMATION_NOTICE } from '../data/legal';

export default function Login() {
  const navigate = useNavigate();
  const { loginWithGoogle, loginWithFacebook, loginWithEmail, registerWithEmail } = useUser();
  const [isSignUp, setIsSignUp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authNotice, setAuthNotice] = useState('');

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setAuthError('');
    try {
      await loginWithGoogle();
      navigate('/explore');
    } catch (e) {
      setAuthError(e.message || "Failed to sign in with Google.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFacebookSignIn = async () => {
    setIsLoading(true);
    setAuthError('');
    try {
      await loginWithFacebook();
      navigate('/explore');
    } catch (e) {
      setAuthError(e.message || "Failed to sign in with Facebook.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailLogin = async ({ email, password }) => {
    setIsLoading(true);
    setAuthError('');
    try {
      await loginWithEmail(email, password);
      navigate('/explore');
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
        setIsSignUp(false);
        return;
      }
      navigate('/onboarding');
    } catch (e) {
      setAuthError(e.message || "Failed to create account.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PageTransition>
      <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full bg-white border border-[#DDE3E0] rounded-3xl p-8 shadow-xl space-y-6">
          <div className="text-center space-y-2">
            <Link to="/" className="inline-flex items-center gap-2 group">
              <div className="w-10 h-10 rounded-2xl bg-[#18A999] flex items-center justify-center text-white font-heading font-extrabold text-xl shadow-md">
                L
              </div>
            </Link>
            <h1 className="text-2xl font-bold font-heading text-[#172121]">
              {isSignUp ? 'Create your account' : 'Welcome back to LEENKIT'}
            </h1>
            <p className="text-xs text-[#3D4948]">
              Find your people. Find something to do anywhere in the world.
            </p>
          </div>

          {/* Social Logins */}
          <div className="space-y-3">
            <button
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="w-full py-3 px-4 bg-white border border-[#DDE3E0] hover:bg-[#EEF1EF] hover:border-[#18A999]/30 rounded-full text-xs font-semibold text-[#172121] flex items-center justify-center gap-3 transition-all shadow-xs cursor-pointer disabled:opacity-50"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              <span>Continue with Google</span>
            </button>

            <button
              onClick={handleFacebookSignIn}
              disabled={isLoading}
              className="w-full py-3 px-4 bg-[#1877F2] hover:bg-[#166fe5] text-white rounded-full text-xs font-semibold flex items-center justify-center gap-3 transition-all shadow-xs cursor-pointer disabled:opacity-50"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
              <span>Continue with Facebook</span>
            </button>

            <p className="text-[11px] text-center text-[#3D4948] leading-relaxed">
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
          </div>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#DDE3E0]" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-3 text-[#3D4948] font-semibold">Or with email</span>
            </div>
          </div>

          {authNotice && !isSignUp && (
            <div role="status" className="p-3 bg-[#DDF4EF] border border-[#18A999]/30 rounded-2xl text-xs font-medium text-[#087F73]">
              {authNotice}
            </div>
          )}

          {/* Email Form */}
          {isSignUp ? (
            <SignUpForm
              onSubmit={handleEmailSignUp}
              onToggleSignIn={() => setIsSignUp(false)}
              isLoading={isLoading}
              error={authError}
            />
          ) : (
            <LoginForm
              onSubmit={handleEmailLogin}
              onToggleSignUp={() => setIsSignUp(true)}
              isLoading={isLoading}
              error={authError}
            />
          )}
        </div>
      </div>
    </PageTransition>
  );
}
