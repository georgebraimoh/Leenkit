import React, { useState } from 'react';
import FormField from '../common/FormField';
import Button from '../common/Button';
import LegalConsentCheckbox from './LegalConsentCheckbox';
import { User, Mail, Lock, AlertCircle } from 'lucide-react';


export default function SignUpForm({ onSubmit, onToggleSignIn, isLoading, error }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [validationError, setValidationError] = useState('');
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [legalError, setLegalError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setValidationError('');
    setLegalError('');

    if (!name.trim() || !email.trim() || !password) {
      setValidationError('Please complete all required fields.');
      return;
    }

    if (name.trim().length > 80) {
      setValidationError('Name can be up to 80 characters.');
      return;
    }

    if (password.length < 8) {
      setValidationError('Password must be at least 8 characters.');
      return;
    }

    if (!acceptedLegal) {
      setLegalError('Please agree to the Terms & Conditions and Privacy Policy to create an account.');
      return;
    }

    onSubmit({ name: name.trim(), email: email.trim(), password, acceptedLegal });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {(error || validationError) && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-medium text-rose-600 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error || validationError}</span>
        </div>
      )}

      <FormField label="Full Name" required>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#6F6F6F]">
            <User className="w-4 h-4" />
          </div>
          <input
            type="text"
            autoComplete="name"
            maxLength={80}
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Alex Danjuma"
            disabled={isLoading}
            className="w-full pl-10 pr-4 py-3 bg-[#EEF1EF] border border-[#DDE3E0] rounded-2xl text-sm focus:outline-none focus:bg-white focus:border-[#18A999] disabled:opacity-50"
          />
        </div>
      </FormField>

      <FormField label="Email Address" required>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#6F6F6F]">
            <Mail className="w-4 h-4" />
          </div>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="name@example.com"
            disabled={isLoading}
            className="w-full pl-10 pr-4 py-3 bg-[#EEF1EF] border border-[#DDE3E0] rounded-2xl text-sm focus:outline-none focus:bg-white focus:border-[#18A999] disabled:opacity-50"
          />
        </div>
      </FormField>

      <FormField label="Password" required helpText="At least 8 characters.">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#6F6F6F]">
            <Lock className="w-4 h-4" />
          </div>
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Create a secure password"
            disabled={isLoading}
            className="w-full pl-10 pr-4 py-3 bg-[#EEF1EF] border border-[#DDE3E0] rounded-2xl text-sm focus:outline-none focus:bg-white focus:border-[#18A999] disabled:opacity-50"
          />
        </div>
      </FormField>

      <LegalConsentCheckbox
        checked={acceptedLegal}
        onChange={(value) => {
          setAcceptedLegal(value);
          if (value) setLegalError('');
        }}
        error={legalError}
        disabled={isLoading}
      />

      <Button
        type="submit"
        variant="primary"
        size="lg"
        fullWidth
        disabled={isLoading || !name.trim() || !email.trim() || password.length < 8}
        className="mt-2"
      >
        {isLoading ? 'Creating account...' : 'Create account'}
      </Button>

      <div className="text-center pt-2">
        <p className="text-xs text-[#6F6F6F]">
          Already have an account?{' '}
          <button
            type="button"
            onClick={onToggleSignIn}
            className="text-[#18A999] font-bold hover:underline cursor-pointer"
          >
            Sign in
          </button>
        </p>
      </div>
    </form>
  );
}
