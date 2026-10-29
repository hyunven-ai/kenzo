'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { login } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    await new Promise(r => setTimeout(r, 400)); // simulate

    const user = await login(username, password);
    if (!user) {
      setError('Username atau password salah. Coba lagi.');
      setLoading(false);
      return;
    }

    // Redirect based on role
    if (user.role === 'kasir') {
      router.push('/transaksi/penjualan');
    } else {
      router.push('/dashboard');
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <div className="login-logo-icon" style={{ background: 'none', boxShadow: 'none' }}>
            <img src="/logo-kenzo.webp" alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          <div className="login-logo-name">Kenzo</div>
          <div className="login-logo-sub">Sistem POS & Inventaris</div>
        </div>

        <div className="login-title">Masuk ke akun Anda</div>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handleLogin}>
          <div className="login-form-group">
            <label className="login-label">Username</label>
            <input
              id="username"
              type="text"
              className="login-input"
              placeholder="Masukkan username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
              required
            />
          </div>

          <div className="login-form-group">
            <label className="login-label">Password</label>
            <input
              id="password"
              type="password"
              className="login-input"
              placeholder="Masukkan password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          <button type="submit" className="login-btn" id="login-submit" disabled={loading}>
            {loading ? (
              <>
                <div className="spinner" style={{ width: 16, height: 16, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }} />
                Memproses...
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                  <polyline points="10 17 15 12 10 7" />
                  <line x1="15" y1="12" x2="3" y2="12" />
                </svg>
                Masuk
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
