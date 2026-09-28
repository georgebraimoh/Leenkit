import React, { useState } from 'react';
import FormField from '../common/FormField';
import Button from '../common/Button';
import { User, Mail, Lock, AlertCircle, Camera } from 'lucide-react';

const AVATAR_OPTIONS = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80"
];

export default function SignUpForm({ onSubmit, onToggleSignIn, isLoading, error }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [avatar, setAvatar] = useState(AVATAR_OPTIONS[0]);
  const [validationError, setValidationError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setValidationError('');

    if (!name.trim() || !email.trim() || !password) {
      setValidationError('Please complete all required fields.');
      return;
    }

    if (password.length < 6) {
      setValidationError('Password must be at least 6 characters.');
      return;
    }

    onSubmit({ name: name.trim(), email: email.trim(), password, avatar });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {(error || validationError) && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-medium text-rose-600 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error || validationError}</span>
        </div>
      )}

      {/* Profile Picture Selector */}
      <FormField label="Choose Profile Picture (Optional)">
        <div className="flex items-center gap-3 pt-1">
          {AVATAR_OPTIONS.map((imgUrl, idx) => (
            <button
              type="button"
              key={idx}
              onClick={() => setAvatar(imgUrl)}
              className={`w-11 h-11 rounded-full overflow-hidden border-2 transition-all cursor-pointer ${
                avatar === imgUrl ? 'border-[#18A999] ring-2 ring-[#18A999]/30 scale-105' : 'border-transparent opacity-70 hover:opacity-100'
              }`}
            >
              <img src={imgUrl} alt="Avatar option" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      </FormField>

      <FormField label="Full Name" required>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#6F6F6F]">
            <User className="w-4 h-4" />
          </div>
          <input
            type="text"
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
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="name@example.com"
            disabled={isLoading}
            className="w-full pl-10 pr-4 py-3 bg-[#EEF1EF] border border-[#DDE3E0] rounded-2xl text-sm focus:outline-none focus:bg-white focus:border-[#18A999] disabled:opacity-50"
          />
        </div>
      </FormField>

      <FormField label="Password" required helpText="At least 6 characters.">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#6F6F6F]">
            <Lock className="w-4 h-4" />
          </div>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Create a secure password"
            disabled={isLoading}
            className="w-full pl-10 pr-4 py-3 bg-[#EEF1EF] border border-[#DDE3E0] rounded-2xl text-sm focus:outline-none focus:bg-white focus:border-[#18A999] disabled:opacity-50"
          />
        </div>
      </FormField>

      <Button
        type="submit"
        variant="primary"
        size="lg"
        fullWidth
        disabled={isLoading || !name.trim() || !email.trim() || password.length < 6}
        className="mt-2"
      >
        {isLoading ? 'Creating account...' : 'Continue to onboarding'}
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
