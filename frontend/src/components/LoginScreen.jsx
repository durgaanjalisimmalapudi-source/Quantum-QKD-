import React, { useState, useEffect } from 'react';
import { login, signup, getDemoAccounts } from '../services/api';

/**
 * LoginScreen Component:
 * Real database-backed Sign In and Sign Up portal for authorities and operators.
 * Pre-seeds Alice and Bob for 1-click test sessions.
 */
export default function LoginScreen({ onLoginSuccess }) {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'

  // Login Form State
  const [email, setEmail] = useState('alice@qkd.org');
  const [password, setPassword] = useState('alice123');

  // Signup Form State
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupSite, setSignupSite] = useState('Station Charlie (Node C)');

  const [showPassword, setShowPassword] = useState(false);
  const [demoAccounts, setDemoAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    getDemoAccounts()
      .then((res) => setDemoAccounts(res.accounts || []))
      .catch(() => {});
  }, []);

  const executeLogin = async (loginEmail, loginPassword) => {
    const targetEmail = loginEmail || email;
    const targetPassword = loginPassword || password;
    if (!targetEmail || !targetPassword) {
      setError('Please provide your authority email and password.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      const data = await login(targetEmail, targetPassword);
      localStorage.setItem('qkd_auth_token', data.token);
      localStorage.setItem('qkd_user', JSON.stringify(data.user));
      onLoginSuccess(data.user);
    } catch (err) {
      setError(err.message || 'Login failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (e) => {
    if (e) e.preventDefault();
    executeLogin(email, password);
  };

  const handleSignup = async (e) => {
    if (e) e.preventDefault();
    if (!signupName || !signupEmail || !signupPassword) {
      setError('Please fill in all required fields.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      const data = await signup({
        name: signupName,
        email: signupEmail,
        password: signupPassword,
        siteName: signupSite,
      });

      localStorage.setItem('qkd_auth_token', data.token);
      localStorage.setItem('qkd_user', JSON.stringify(data.user));
      onLoginSuccess(data.user);
    } catch (err) {
      setError(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const selectDemoAccount = (acc) => {
    const defaultPass = acc.defaultPassword || 'password123';
    setEmail(acc.email);
    setPassword(defaultPass);
    setError('');
    setMode('login');
    executeLogin(acc.email, defaultPass);
  };

  return (
    <div className="min-h-screen bg-[#0c1317] flex flex-col justify-between text-[#e9edef] font-sans antialiased selection:bg-[#00a884] selection:text-white">
      {/* Top emerald accent bar */}
      <div className="h-1.5 bg-[#00a884] w-full" />

      {/* Main Split Layout: Title on Left, Signup Interface on Right */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-3 sm:px-8 py-6 sm:py-12 flex flex-col lg:flex-row items-center justify-between gap-6 sm:gap-8 lg:gap-16 my-auto">
        {/* Left Side: Title & Subtitle */}
        <div className="w-full lg:w-1/2 flex flex-col justify-center items-center lg:items-start text-center lg:text-left">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-[#00a884]/20 border border-[#00a884]/40 flex items-center justify-center text-[#00a884] shadow-sm mb-3 sm:mb-4">
            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
          <h1 className="text-2xl sm:text-4xl lg:text-[42px] font-extrabold text-[#e9edef] tracking-tight leading-tight">
            QUANTUM SECURE CHAT PORTAL
          </h1>
          <p className="text-sm sm:text-lg text-[#00a884] font-medium mt-2 sm:mt-3 leading-relaxed">
            Real dynamic E91 key distribution
          </p>
        </div>

        {/* Right Side: Auth Card (Sign In / Sign Up) */}
        <div className="w-full max-w-md flex-shrink-0">
          <div className="bg-[#111b21] border border-[#222d34] rounded-xl sm:rounded-2xl shadow-2xl p-4 sm:p-8 backdrop-blur-lg">
          {/* Tabs: Sign In vs Sign Up */}
          <div className="flex items-center bg-[#202c33] p-1 rounded-xl mb-6 border border-[#222d34]">
            <button
              type="button"
              onClick={() => { setMode('login'); setError(''); }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${
                mode === 'login' ? 'bg-[#00a884] text-white shadow-sm' : 'text-[#8696a0] hover:text-white'
              }`}
            >
              Sign In (Existing)
            </button>
            <button
              type="button"
              onClick={() => { setMode('signup'); setError(''); }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${
                mode === 'signup' ? 'bg-[#00a884] text-white shadow-sm' : 'text-[#8696a0] hover:text-white'
              }`}
            >
              Create Account (Sign Up)
            </button>
          </div>

          <div className="text-center mb-5">
            <h2 className="text-lg font-bold text-[#e9edef]">
              {mode === 'login' ? 'Authority Terminal Sign In' : 'Register New Quantum Node Operator'}
            </h2>
            <p className="text-xs text-[#8696a0] mt-1">
              {mode === 'login'
                ? 'Sign in to access encrypted quantum communications'
                : 'Your profile will be saved to PostgreSQL and visible to all other operators'}
            </p>
          </div>

          {error && (
            <div className="mb-4 text-xs bg-[#ea4335]/15 border border-[#ea4335]/40 text-[#fca5a5] p-3 rounded-xl flex items-center gap-2">
              <span>⚠️</span> {error}
            </div>
          )}

          {successMsg && (
            <div className="mb-4 text-xs bg-[#00a884]/15 border border-[#00a884]/40 text-[#34d399] p-3 rounded-xl flex items-center gap-2">
              <span>✓</span> {successMsg}
            </div>
          )}

          {/* SIGN IN FORM */}
          {mode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#8696a0] mb-1.5">
                  Authority Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="alice@qkd.org or bob@qkd.org"
                  className="w-full bg-[#202c33] border border-[#222d34] rounded-xl px-4 py-2.5 text-sm text-[#e9edef] placeholder-[#8696a0] focus:outline-none focus:border-[#00a884] transition"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-medium text-[#8696a0]">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-[11px] text-[#00a884] hover:underline"
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-[#202c33] border border-[#222d34] rounded-xl px-4 py-2.5 text-sm text-[#e9edef] placeholder-[#8696a0] focus:outline-none focus:border-[#00a884] transition"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-[#00a884] hover:bg-[#009272] disabled:opacity-50 text-white font-semibold text-sm rounded-xl transition shadow-lg shadow-[#00a884]/20 flex items-center justify-center gap-2 mt-2"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    Authenticating...
                  </>
                ) : (
                  'Sign In to Chat'
                )}
              </button>
            </form>
          ) : (
            /* SIGN UP FORM */
            <form onSubmit={handleSignup} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-[#8696a0] mb-1">
                  Full Name / Operator ID *
                </label>
                <input
                  type="text"
                  required
                  value={signupName}
                  onChange={(e) => setSignupName(e.target.value)}
                  placeholder="e.g. Charlie Evans (Relay Node 4)"
                  className="w-full bg-[#202c33] border border-[#222d34] rounded-xl px-4 py-2 text-sm text-[#e9edef] placeholder-[#8696a0] focus:outline-none focus:border-[#00a884] transition"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#8696a0] mb-1">
                  Official Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  placeholder="e.g. charlie@qkd.org"
                  className="w-full bg-[#202c33] border border-[#222d34] rounded-xl px-4 py-2 text-sm text-[#e9edef] placeholder-[#8696a0] focus:outline-none focus:border-[#00a884] transition"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#8696a0] mb-1">
                  Station / Infrastructure Site
                </label>
                <input
                  type="text"
                  value={signupSite}
                  onChange={(e) => setSignupSite(e.target.value)}
                  placeholder="e.g. Station Charlie (East Grid Hub)"
                  className="w-full bg-[#202c33] border border-[#222d34] rounded-xl px-4 py-2 text-sm text-[#e9edef] placeholder-[#8696a0] focus:outline-none focus:border-[#00a884] transition"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#8696a0] mb-1">
                  Security Password (min 6 characters) *
                </label>
                <input
                  type="password"
                  required
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-[#202c33] border border-[#222d34] rounded-xl px-4 py-2 text-sm text-[#e9edef] placeholder-[#8696a0] focus:outline-none focus:border-[#00a884] transition"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-[#00a884] hover:bg-[#009272] disabled:opacity-50 text-white font-semibold text-sm rounded-xl transition shadow-lg shadow-[#00a884]/20 flex items-center justify-center gap-2 mt-2"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    Creating PostgreSQL Account...
                  </>
                ) : (
                  'Create Account & Enter Chat'
                )}
              </button>
            </form>
          )}

          {/* Quick Demo Accounts (Alice & Bob) */}
          <div className="mt-6 pt-5 border-t border-[#222d34]">
            <p className="text-[11px] font-semibold text-[#8696a0] uppercase tracking-wider mb-2.5 text-center">
              Demo Accounts (1-Click Login)
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {demoAccounts.map((acc) => (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => selectDemoAccount(acc)}
                  className={`p-2.5 rounded-xl border text-left transition flex items-center gap-2.5 ${
                    email === acc.email && mode === 'login'
                      ? 'bg-[#202c33] border-[#00a884] shadow-sm'
                      : 'bg-[#111b21] border-[#222d34] hover:bg-[#202c33]/70'
                  }`}
                >
                  <img
                    src={acc.avatar}
                    alt={acc.name}
                    className="w-8 h-8 rounded-full object-cover border border-[#222d34] flex-shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-[#e9edef] truncate">{acc.name}</div>
                    <div className="text-[10px] text-[#00a884] font-mono truncate">{acc.email}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-[#8696a0] font-mono">
        UC025 Dynamic E91 Quantum Key Distribution · PostgreSQL Database Auth Active
      </footer>
    </div>
  );
}
