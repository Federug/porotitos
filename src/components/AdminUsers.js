import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

function getInitials(n) { return n.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2) }

export default function AdminUsers() {
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(null) // player id being set up
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState('player')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  useEffect(() => { loadPlayers() }, [])

  async function loadPlayers() {
    const { data } = await supabase.from('players').select('*').order('name')
    setPlayers(data || [])
    setLoading(false)
  }

  function startCreate(player) {
    setCreating(player.id)
    setNewEmail('')
    setNewPassword('')
    setNewRole(player.role || 'player')
    setMsg('')
    setError('')
  }

  async function handleCreateUser(player) {
    if (!newEmail || !newPassword) return setError('Completá email y contraseña')
    if (newPassword.length < 6) return setError('La contraseña debe tener al menos 6 caracteres')
    setSaving(true)
    setError('')

    // Use Supabase Admin API via edge function workaround:
    // We use signUp then link to player. Since we can't use admin SDK from frontend,
    // we create the user via signup and immediately update the player record.
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email: newEmail,
      password: newPassword,
      options: { data: { player_name: player.name } }
    })

    if (signUpError) {
      setSaving(false)
      return setError('Error al crear usuario: ' + signUpError.message)
    }

    const userId = authData.user?.id
    if (!userId) {
      setSaving(false)
      return setError('No se pudo obtener el ID del usuario')
    }

    // Link auth user to player
    const { error: updateError } = await supabase
      .from('players')
      .update({ auth_user_id: userId, role: newRole })
      .eq('id', player.id)

    setSaving(false)
    if (updateError) return setError('Error al vincular usuario: ' + updateError.message)

    setMsg(`✓ Usuario creado para ${player.name}`)
    setCreating(null)
    await loadPlayers()
  }

  async function handleUpdateRole(playerId, role) {
    await supabase.from('players').update({ role }).eq('id', playerId)
    await loadPlayers()
  }

  async function handleUnlink(playerId) {
    if (!window.confirm('¿Desvincular el acceso de este jugador?')) return
    await supabase.from('players').update({ auth_user_id: null }).eq('id', playerId)
    await loadPlayers()
  }

  if (loading) return <div className="loading">Cargando usuarios...</div>

  return (
    <div>
      <h2>🔐 Gestión de Usuarios</h2>
      <div style={{ padding:'12px 16px', background:'rgba(91,138,245,0.08)', border:'1px solid rgba(91,138,245,0.25)', borderRadius:8, marginBottom:20, fontSize:13, color:'var(--accent-blue)' }}>
        Acá podés crear accesos para cada jugador. Cada jugador necesita un email y contraseña para iniciar sesión.
      </div>

      {msg && <div style={{ padding:'10px 16px', background:'var(--accent-green-dim)', border:'1px solid rgba(34,211,165,0.3)', borderRadius:8, marginBottom:16, fontSize:13, color:'var(--accent-green)' }}>{msg}</div>}

      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {players.map(p => (
          <div key={p.id} className="card" style={{ padding:'16px 20px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              {/* Avatar */}
              {p.photo_url
                ? <img src={p.photo_url} alt="" style={{ width:40, height:40, borderRadius:'50%', objectFit:'cover', border:`2px solid ${p.avatar_color}55`, flexShrink:0 }} />
                : <div className="player-avatar" style={{ width:40, height:40, fontSize:14, background:p.avatar_color+'22', color:p.avatar_color, border:`2px solid ${p.avatar_color}44`, flexShrink:0 }}>{getInitials(p.name)}</div>
              }

              <div style={{ flex:1 }}>
                <div style={{ fontWeight:600, fontSize:15, color:'var(--text-primary)' }}>{p.name}</div>
                <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>
                  {p.auth_user_id
                    ? <span style={{ color:'var(--accent-green)' }}>✓ Acceso configurado</span>
                    : <span style={{ color:'var(--text-muted)' }}>Sin acceso</span>
                  }
                </div>
              </div>

              {/* Role badge */}
              {p.auth_user_id && (
                <select
                  value={p.role || 'player'}
                  onChange={e => handleUpdateRole(p.id, e.target.value)}
                  style={{
                    width:110, fontSize:12, padding:'5px 8px',
                    background: p.role==='admin' ? 'rgba(255,70,85,0.1)' : 'var(--bg-surface)',
                    borderColor: p.role==='admin' ? 'var(--accent)' : 'var(--border)',
                    color: p.role==='admin' ? 'var(--accent)' : 'var(--text-secondary)'
                  }}
                >
                  <option value="player">👤 Jugador</option>
                  <option value="admin">⚡ Admin</option>
                </select>
              )}

              {/* Actions */}
              <div style={{ display:'flex', gap:8 }}>
                {!p.auth_user_id ? (
                  <button
                    className="btn btn-sm"
                    style={{ borderColor:'var(--accent-blue)', color:'var(--accent-blue)' }}
                    onClick={() => startCreate(p)}
                  >
                    + Crear acceso
                  </button>
                ) : (
                  <button className="btn btn-sm btn-danger" onClick={() => handleUnlink(p.id)}>
                    Desvincular
                  </button>
                )}
              </div>
            </div>

            {/* Create user form */}
            {creating === p.id && (
              <div style={{ marginTop:16, paddingTop:16, borderTop:'1px solid var(--border)' }}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr auto', gap:10, alignItems:'flex-end' }}>
                  <div className="form-group" style={{ marginBottom:0 }}>
                    <label>Email</label>
                    <input type="email" placeholder="jugador@email.com" value={newEmail} onChange={e => setNewEmail(e.target.value)} />
                  </div>
                  <div className="form-group" style={{ marginBottom:0 }}>
                    <label>Contraseña inicial</label>
                    <input type="password" placeholder="Mínimo 6 caracteres" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                  </div>
                  <div style={{ display:'flex', gap:8 }}>
                    <button className="btn btn-sm btn-primary" onClick={() => handleCreateUser(p)} disabled={saving}>
                      {saving ? '...' : 'Crear'}
                    </button>
                    <button className="btn btn-sm" onClick={() => setCreating(null)}>×</button>
                  </div>
                </div>
                <div className="form-group" style={{ marginTop:10, marginBottom:0 }}>
                  <label>Rol</label>
                  <select value={newRole} onChange={e => setNewRole(e.target.value)} style={{ width:160 }}>
                    <option value="player">👤 Jugador</option>
                    <option value="admin">⚡ Admin</option>
                  </select>
                </div>
                {error && <p style={{ color:'var(--accent)', fontSize:13, marginTop:8 }}>{error}</p>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
