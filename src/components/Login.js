import React, { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin() {
    if (!email || !password) return setError('Completá todos los campos')
    setLoading(true)
    setError('')
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) setError(err.message === 'Invalid login credentials' ? 'Email o contraseña incorrectos' : err.message)
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-base)', padding: 24
    }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ fontSize: 52, marginBottom: 8 }}>🫘</div>
          <h1 style={{
            fontFamily: 'Rajdhani, sans-serif', fontSize: 32, fontWeight: 700,
            color: 'var(--accent)', letterSpacing: 3, margin: 0
          }}>POROTITOS</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>Valorant Team Tracker</p>
        </div>

        {/* Card */}
        <div className="card" style={{ padding: 28 }}>
          <h3 style={{ marginBottom: 20, fontSize: 15, color: 'var(--text-primary)' }}>Iniciar sesión</h3>

          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              placeholder="tu@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label>Contraseña</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div style={{
              padding: '10px 14px', background: 'var(--accent-dim)',
              border: '1px solid rgba(255,70,85,0.3)', borderRadius: 8,
              color: 'var(--accent)', fontSize: 13, marginBottom: 16
            }}>
              {error}
            </div>
          )}

          <button
            className="btn btn-primary"
            style={{ width: '100%', padding: '11px', fontSize: 14, fontWeight: 600 }}
            onClick={handleLogin}
            disabled={loading}
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </div>

        <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', marginTop: 16 }}>
          Si no tenés contraseña, pedísela al admin del squad
        </p>
      </div>
    </div>
  )
}
