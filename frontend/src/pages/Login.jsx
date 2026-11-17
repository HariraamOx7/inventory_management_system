import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Lock, User, Eye, EyeOff, ArrowRight, Loader2, AlertCircle, Info } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import logoImg from '../assets/logo.png';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState('');
  const [sessionAlert, setSessionAlert] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const { login, loading, error, clearError, isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }

    const params = new URLSearchParams(location.search);
    if (params.get('session_expired') === 'true') {
      setSessionAlert(true);
    }
  }, [isAuthenticated, navigate, location]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    clearError();

    if (!username.trim() || !password) {
      setFormError('Please enter username and password');
      return;
    }

    const result = await login(username.trim(), password);
    if (result.success) {
      navigate('/dashboard', { replace: true });
    }
  };

  const displayError = formError || error;

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-slate-50 font-sans">
      {/* Left Side: Logo */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 sm:p-12 lg:p-20 bg-white border-b lg:border-b-0 lg:border-r border-slate-200/80">
        <div className="w-full max-w-lg flex items-center justify-center">
          <img
            src={logoImg}
            alt="Logo"
            className="w-full max-h-48 sm:max-h-64 object-contain select-none"
          />
        </div>
      </div>

      {/* Right Side: Sign In Box */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 lg:p-16">
        <div className="w-full max-w-sm bg-white border border-slate-200/90 rounded-2xl p-7 sm:p-8 shadow-xl shadow-slate-200/60">
          {/* Session Alert */}
          {sessionAlert && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2.5 text-amber-800 text-xs">
              <Info size={16} className="shrink-0 text-amber-600" />
              <span>Session expired. Please sign in.</span>
            </div>
          )}

          {/* Error Banner */}
          {displayError && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2.5 text-rose-800 text-xs">
              <AlertCircle size={16} className="shrink-0 text-rose-600" />
              <span>{displayError}</span>
            </div>
          )}

          {/* Simple Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <div className="relative">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                <User size={18} />
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (displayError) setFormError('');
                }}
                placeholder="Username"
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 text-sm font-medium focus:bg-white focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20 outline-none transition-all"
                autoFocus
                required
              />
            </div>

            {/* Password */}
            <div className="relative">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                <Lock size={18} />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (displayError) setFormError('');
                }}
                placeholder="Password"
                className="w-full pl-11 pr-11 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 text-sm font-medium focus:bg-white focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20 outline-none transition-all"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold text-sm rounded-xl shadow-lg shadow-indigo-600/25 hover:shadow-indigo-600/35 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight size={17} />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;