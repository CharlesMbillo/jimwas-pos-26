// Login Page - Authentication form

import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { hasRemoteUsers, setupFirstAdministrator } from '../lib/auth';
import { Lock, User, Eye, EyeOff, LogIn, AlertCircle, UserPlus, Mail } from 'lucide-react';

export function LoginPage() {
  const { login, isLoading: authLoading } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [setupEmail, setSetupEmail] = useState('');
  const [setupName, setSetupName] = useState('');
  const [showSetup, setShowSetup] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingSetup, setIsCheckingSetup] = useState(true);
  const [hasUsers, setHasUsers] = useState(true);

  useEffect(() => {
    hasRemoteUsers().then(setHasUsers).finally(() => setIsCheckingSetup(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = await login(username, password);
      if (!result.success) {
        setError(result.error || 'Login failed');
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFirstAdminSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    const result = await setupFirstAdministrator(username, setupEmail, password, setupName);
    if (!result.success) {
      setError(result.error || 'Unable to create administrator');
    } else {
      setShowSetup(false);
      setHasUsers(true);
      setError('Administrator created. Check your email if confirmation is required, then sign in.');
    }
    setIsLoading(false);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-400 mx-auto"></div>
          <p className="mt-4 text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo and Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-600 mb-4">
            <Lock size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">Jimwas POS</h1>
          <p className="text-slate-400 mt-2">Sign in to your account</p>
        </div>

        {/* Login Form */}
        <div className="bg-slate-800 rounded-xl p-6 shadow-xl border border-slate-700">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-300">
                <AlertCircle size={20} />
                <p className="text-sm">{error}</p>
              </div>
            )}

            {/* Username Field */}
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-slate-300 mb-2">
                Username
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  placeholder="Enter your username"
                  required
                  autoFocus
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-12 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Signing in...
                </>
              ) : (
                <>
                  <LogIn size={20} />
                  Sign In
                </>
              )}
            </button>
          </form>

          {!isCheckingSetup && !hasUsers && !showSetup && (
            <button
              type="button"
              onClick={() => setShowSetup(true)}
              className="mt-4 w-full py-3 border border-emerald-500/60 text-emerald-300 rounded-lg font-medium hover:bg-emerald-500/10 transition flex items-center justify-center gap-2"
            >
              <UserPlus size={18} />
              Create first administrator
            </button>
          )}

          {!isCheckingSetup && !hasUsers && showSetup && (
            <form onSubmit={handleFirstAdminSetup} className="mt-6 space-y-4 border-t border-slate-700 pt-6">
              <h2 className="text-lg font-semibold text-white">Create first administrator</h2>
              <p className="text-sm text-slate-400">This option is available only while no POS users exist.</p>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input value={setupName} onChange={(e) => setSetupName(e.target.value)} placeholder="Full name" className="w-full pl-10 pr-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600" required />
              </div>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input type="email" value={setupEmail} onChange={(e) => setSetupEmail(e.target.value)} placeholder="Email address" className="w-full pl-10 pr-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600" required />
              </div>
              <button type="submit" disabled={isLoading} className="w-full py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50">
                {isLoading ? 'Creating account...' : 'Create administrator'}
              </button>
            </form>
          )}

        </div>

        {/* Footer */}
        <p className="text-center text-slate-500 text-sm mt-6">
          Jimwas POS v2.0 - Secure Point of Sale
        </p>
      </div>
    </div>
  );
}
