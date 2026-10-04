import React, { useState } from 'react';
import FormField from '../common/FormField';
import Button from '../common/Button';
import { Eye, EyeOff, Lock, Mail, AlertCircle, CheckCircle2 } from 'lucide-react';
import { authService } from '../../services/auth/authService';

export default function LoginForm({ onSubmit, onToggleSignUp, isLoading, error }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');
  const [isResetLoading, setIsResetLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setValidationError('');
    setResetSuccess('');

    if (!email.trim() || !password) {
      setValidationError('Please enter both your email and password.');
      return;
    }

    onSubmit({ email: email.trim(), password });
  };

  const handleForgotPassword = async () => {
    setValidationError('');
    setResetSuccess('');

    if (!email.trim()) {
      setValidationError('Please enter your email address to reset your password.');
      return;
    }

    const emailRegex = /\S+@\S+\.\S+/;
    if (!emailRegex.test(email.trim())) {
      setValidationError('Please enter a valid email address.');
      return;
    }

    setIsResetLoading(true);
    try {
      await authService.resetPasswordForEmail(email.trim());
      setResetSuccess('Password reset link sent! Check your inbox.');
    } catch (err) {
      setValidationError(err.message || 'Failed to send password reset email.');
    } finally {
      setIsResetLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {(error || validationError) && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-medium text-rose-600 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error || validationError}</span>
        </div>
      )}

      {resetSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-medium text-emerald-700 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{resetSuccess}</span>
        </div>
      )}

      <FormField label="Email address" required>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#6F6F6F]">
            <Mail className="w-4 h-4" />
          </div>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={e => {
              setEmail(e.target.value);
              if (validationError) setValidationError('');
            }}
            placeholder="name@example.com"
            disabled={isLoading || isResetLoading}
            className="w-full pl-10 pr-4 py-3 bg-[#EEF1EF] border-2 border-ink rounded-2xl text-sm focus:outline-none focus:bg-white focus:border-[#18A999] disabled:opacity-50"
          />
        </div>
      </FormField>

      <FormField label="Password" required>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#6F6F6F]">
            <Lock className="w-4 h-4" />
          </div>
          <input
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Enter your password"
            disabled={isLoading || isResetLoading}
            className="w-full pl-10 pr-10 py-3 bg-[#EEF1EF] border-2 border-ink rounded-2xl text-sm focus:outline-none focus:bg-white focus:border-[#18A999] disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#6F6F6F] hover:text-[#111111] cursor-pointer"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </FormField>

      <div className="flex items-center justify-between text-xs pt-1">
        <button
          type="button"
          onClick={handleForgotPassword}
          disabled={isLoading || isResetLoading}
          className="text-[#6F6F6F] hover:text-[#18A999] font-medium cursor-pointer disabled:opacity-50 transition-colors"
        >
          {isResetLoading ? 'Sending reset link...' : 'Forgot password?'}
        </button>
      </div>

      <Button
        type="submit"
        variant="primary"
        size="lg"
        fullWidth
        disabled={isLoading || isResetLoading || !email.trim() || !password}
        className="mt-2"
      >
        {isLoading ? 'Signing in...' : 'Sign in'}
      </Button>

      <div className="text-center pt-2">
        <p className="text-xs text-[#6F6F6F]">
          Don't have an account?{' '}
          <button
            type="button"
            onClick={onToggleSignUp}
            className="text-[#18A999] font-bold hover:underline cursor-pointer"
          >
            Create account
          </button>
        </p>
      </div>
    </form>
  );
}
