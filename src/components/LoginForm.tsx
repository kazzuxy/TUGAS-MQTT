import React, { useState } from 'react';
import { loginUser, registerUser, isAuthMocked } from '../firebase';
import { Cpu, KeyRound, Mail, UserPlus, LogIn, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface LoginFormProps {
  onLoginSuccess: (user: { uid: string; email: string | null }) => void;
}

export function LoginForm({ onLoginSuccess }: LoginFormProps) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Initial validations
    if (!email.trim() || !password.trim()) {
      setError('Email dan Password wajib diisi.');
      return;
    }

    if (password.length < 6) {
      setError('Password minimal terdiri dari 6 karakter.');
      return;
    }

    setLoading(true);
    try {
      if (isRegister) {
        const user = await registerUser(email, password);
        onLoginSuccess(user);
      } else {
        const user = await loginUser(email, password);
        onLoginSuccess(user);
      }
    } catch (err: any) {
      setError(err?.message || 'Terjadi kesalahan sistem.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#090d16] text-[#e2e8f0] px-4 relative overflow-hidden font-sans">
      {/* Background visual graphics */}
      <div className="absolute top-[-10%] left-[-20%] w-[60vw] h-[60vw] rounded-full bg-blue-900/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-20%] w-[50vw] h-[50vw] rounded-full bg-indigo-900/10 blur-[120px] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="w-full max-w-md bg-[#111827]/85 backdrop-blur-md px-6 py-8 rounded-2xl border border-slate-800/80 shadow-2xl relative"
        id="login-card"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-[0_0_20px_rgba(37,99,235,0.4)] mb-4">
            <Cpu className="w-7 h-7 text-white animate-pulse" />
          </div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white font-sans text-center">
            IoT MULTI-BROKER
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-mono uppercase tracking-wider text-center">
            {isRegister ? 'Daftar Akun Baru' : 'Sistem Kendali & Telemetri'}
          </p>
        </div>

        {isAuthMocked() && (
          <div className="mb-5 bg-amber-500/10 border border-amber-500/20 px-3.5 py-2.5 rounded-lg text-amber-200 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Mode Simulasi Sandboxed</p>
              <p className="opacity-90 leading-relaxed mt-0.5">
                Konfigurasi Firebase default adalah simulasi. Anda dapat mendaftar dan masuk dengan email/password apa pun.
              </p>
            </div>
          </div>
        )}

        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-5 bg-red-500/15 border border-red-500/30 text-red-200 px-4 py-3 rounded-lg text-xs flex items-center gap-2.5"
              id="login-error-alert"
            >
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-mono text-slate-400 uppercase tracking-wider mb-1.5 font-medium">
              Alamat Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                id="login-email-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@email.com"
                className="w-full bg-[#1e293b]/50 border border-slate-700/80 rounded-xl py-3 pl-11 pr-4 text-sm text-white placeholder-slate-500 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all font-sans"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono text-slate-400 uppercase tracking-wider mb-1.5 font-medium">
              Kata Sandi
            </label>
            <div className="relative">
              <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                id="login-password-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
                className="w-full bg-[#1e293b]/50 border border-slate-700/80 rounded-xl py-3 pl-11 pr-4 text-sm text-white placeholder-slate-500 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all font-mono"
                required
              />
            </div>
          </div>

          <button
            id="login-submit-button"
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-sans text-sm font-semibold py-3 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 mt-6 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : isRegister ? (
              <>
                <UserPlus className="w-4 h-4" />
                <span>Daftar Sekarang</span>
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                <span>Masuk Ke Dashboard</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-slate-800/80 text-center">
          <button
            id="toggle-auth-mode-button"
            onClick={() => {
              setIsRegister(!isRegister);
              setError(null);
            }}
            className="text-xs text-blue-400 hover:text-blue-300 font-sans cursor-pointer focus:outline-none"
          >
            {isRegister 
              ? 'Sudah punya akun? Masuk di sini' 
              : 'Belum punya akun? Buat akun gratis'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
