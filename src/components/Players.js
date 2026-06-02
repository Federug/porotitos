import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const AVATAR_COLORS = [
  '#ff4655', '#22d3a5', '#5b8af5', '#f5a623',
  '#c084fc', '#fb923c', '#f472b6', '#34d399'
]

function getInitials(name) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

export default function Players({ onUpdate }) {
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(AVATAR_COLORS[0])
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const [playerStats, setPlayerStats] = useState({})

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const { data: p } = await supabase.from('players').select('*').order('name')
    setPlayers(p || [])

    const { data: events } = await supabase.from('match_events').select('player_id, points')
    const totals = {}
    const counts = {}
    if (events) {
      events.forEach(e => {
        totals[e.player_id] = (totals[e.player_id] || 0) + e.points
        counts[e.player_id] = (counts[e.player_id] || 0) + 1
      })
    }
    const stats = {}
    ;(p || []).forEach(pl => {
      stats[pl.id] = { total: totals[pl.id] || 0, events: counts[pl.id] || 0 }
    })
    setPlayerStats(stats)
    setLoading(false)
  }

  async function addPlayer() {
    if (!newName.trim()) return setError('Ingresá un nombre')
    setAdding(true)
    const { error: err } = await supabase
      .from('players')
      .insert({ name: newName.trim(), avatar_color: newColor })
    if (err) {
      setError('Error al agregar: ' + err.message)
    } else {
      setNewName('')
      setNewColor(AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)])
      setError('')
      await loadAll()
      onUpdate()
    }
    setAdding(false)
  }

  async function deletePlayer(id) {
    if (!window.confirm('¿Eliminar este jugador? Se perderán todos sus datos.')) return
    await supabase.from('players').delete().eq('id', id)
    await loadAll()
    onUpdate()
  }

  if (loading) return <div className="loading">Cargando jugadores...</div>

  return (
    <div>
      <h2>👥 Jugadores</h2>

      {/* Add player */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h3>Agregar jugador</h3>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ flex: 1, minWidth: 160, marginBottom: 0 }}>
            <label>Nombre / IGN</label>
            <input
              placeholder="ej: Ricky"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addPlayer()}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Color</label>
            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              {AVATAR_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setNewColor(c)}
                  style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: c,
                    border: newColor === c ? '2px solid white' : '2px solid transparent',
                    cursor: 'pointer',
                    boxShadow: newColor === c ? `0 0 0 2px ${c}` : 'none'
                  }}
                />
              ))}
            </div>
          </div>
          <button className="btn btn-primary" onClick={addPlayer} disabled={adding || !newName.trim()}>
            {adding ? 'Agregando...' : '+ Agregar'}
          </button>
        </div>
        {error && <p style={{ color: 'var(--accent)', fontSize: 13, marginTop: 8 }}>{error}</p>}
      </div>

      {/* Player list */}
      {players.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">👤</div>
          <p>No hay jugadores. Agregá a tu squad.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
          {players.map(p => {
            const st = playerStats[p.id] || { total: 0, events: 0 }
            return (
              <div key={p.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    className="player-avatar"
                    style={{
                      width: 44, height: 44, fontSize: 16,
                      background: p.avatar_color + '22',
                      color: p.avatar_color,
                      border: `2px solid ${p.avatar_color}55`
                    }}
                  >
                    {getInitials(p.name)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-primary)' }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {st.events} evento{st.events !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <div style={{
                    fontFamily: 'Rajdhani, sans-serif',
                    fontSize: 22,
                    fontWeight: 700,
                    color: st.total > 0 ? 'var(--accent)' : st.total < 0 ? 'var(--accent-green)' : 'var(--text-muted)'
                  }}>
                    {st.total > 0 ? '+' : ''}{st.total}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ flex: 1, background: 'var(--bg-surface)', borderRadius: 6, padding: '8px 10px', textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Porotos</div>
                    <div style={{
                      fontFamily: 'Rajdhani, sans-serif',
                      fontSize: 18,
                      fontWeight: 700,
                      color: st.total > 0 ? 'var(--accent)' : st.total < 0 ? 'var(--accent-green)' : 'var(--text-muted)'
                    }}>
                      {st.total > 0 ? '+' : ''}{st.total} 🫘
                    </div>
                  </div>
                </div>

                <button
                  className="btn btn-sm btn-danger"
                  style={{ alignSelf: 'flex-end' }}
                  onClick={() => deletePlayer(p.id)}
                >
                  Eliminar
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
