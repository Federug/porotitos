import React, { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function ChangePassword({ onClose }) {
  const [current, setCurrent] = useState('')
  const [newPass, setNewPass] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function handleChange() {
    if (!newPass || !confirm) return setError('Completá todos los campos')
    if (newPass.length < 6) return setError('La contraseña debe tener al menos 6 caracteres')
    if (newPass !== confirm) return setError('Las contraseñas no coinciden')
    setLoading(true)
    setError('')
    const { error: err } = await supabase.auth.updateUser({ password: newPass })
    setLoading(false)
    if (err) return setError('Error: ' + err.message)
    setSuccess(true)
    setTimeout(() => onClose(), 2000)
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
      <div className="card" style={{ width:380, maxWidth:'95vw', padding:28 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <h3 style={{ margin:0, fontSize:16, color:'var(--text-primary)' }}>🔑 Cambiar contraseña</h3>
          <button className="btn btn-sm" onClick={onClose}>×</button>
        </div>

        {success ? (
          <div style={{ textAlign:'center', padding:'20px 0' }}>
            <div style={{ fontSize:40, marginBottom:12 }}>✅</div>
            <p style={{ color:'var(--accent-green)', fontWeight:600 }}>Contraseña actualizada</p>
          </div>
        ) : (
          <>
            <div className="form-group">
              <label>Nueva contraseña</label>
              <input type="password" placeholder="Mínimo 6 caracteres" value={newPass} onChange={e => setNewPass(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Confirmar contraseña</label>
              <input type="password" placeholder="Repetí la contraseña" value={confirm} onChange={e => setConfirm(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleChange()} />
            </div>
            {error && <div style={{ padding:'10px 14px', background:'var(--accent-dim)', border:'1px solid rgba(255,70,85,0.3)', borderRadius:8, color:'var(--accent)', fontSize:13, marginBottom:16 }}>{error}</div>}
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button className="btn" onClick={onClose}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleChange} disabled={loading}>{loading ? 'Guardando...' : 'Cambiar'}</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
