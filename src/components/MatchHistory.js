import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import NewMatch from './NewMatch'

export default function MatchHistory() {
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)
  const [matchDetails, setMatchDetails] = useState({})
  const [editingMatch, setEditingMatch] = useState(null)

  useEffect(() => { loadMatches() }, [])

  async function loadMatches() {
    const { data } = await supabase
      .from('matches')
      .select('*')
      .order('played_at', { ascending: false })
    setMatches(data || [])
    setLoading(false)
  }

  async function loadDetails(matchId, force = false) {
    if (matchDetails[matchId] && !force) return
    const { data } = await supabase
      .from('match_events')
      .select('*, players(name, avatar_color), categories(name, points)')
      .eq('match_id', matchId)
    setMatchDetails(prev => ({ ...prev, [matchId]: data || [] }))
  }

  async function deleteMatch(id) {
    if (!window.confirm('¿Eliminar esta partida?')) return
    await supabase.from('matches').delete().eq('id', id)
    setMatches(matches.filter(m => m.id !== id))
  }

  function toggleExpand(id) {
    if (expanded === id) {
      setExpanded(null)
    } else {
      setExpanded(id)
      loadDetails(id)
    }
  }

  function handleEditSaved() {
    setEditingMatch(null)
    loadMatches()
    if (expanded) {
      setMatchDetails(prev => { const n = { ...prev }; delete n[expanded]; return n })
      loadDetails(expanded, true)
    }
  }

  if (loading) return <div className="loading">Cargando historial...</div>

  if (editingMatch) {
    return <NewMatch editMatch={editingMatch} onSaved={handleEditSaved} />
  }

  return (
    <div>
      <h2>📋 Historial de Partidas</h2>

      {matches.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">🎮</div>
          <p>No hay partidas registradas todavía.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {matches.map(m => {
            const details = matchDetails[m.id] || []
            const isOpen = expanded === m.id

            const byPlayer = {}
            details.forEach(e => {
              const pid = e.player_id
              if (!byPlayer[pid]) byPlayer[pid] = { name: e.players?.name, color: e.players?.avatar_color, events: [], total: 0 }
              byPlayer[pid].events.push(e)
              byPlayer[pid].total += e.points
            })

            return (
              <div key={m.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {/* Header row */}
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', cursor: 'pointer' }}
                  onClick={() => toggleExpand(m.id)}
                >
                  <span className={`badge ${m.result === 'victoria' ? 'badge-win' : m.result === 'derrota' ? 'badge-loss' : 'badge-draw'}`}>
                    {m.result === 'victoria' ? '✓ Victoria' : m.result === 'derrota' ? '✗ Derrota' : '= Empate'}
                  </span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'Rajdhani, sans-serif', fontSize: 16 }}>
                    {m.map}
                  </span>
                  {m.score_us != null && m.score_them != null && (
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                      {m.score_us} – {m.score_them}
                    </span>
                  )}
                  {m.edited_at && (
                    <span style={{
                      fontSize: 11,
                      color: 'var(--accent-amber)',
                      background: 'rgba(245,166,35,0.1)',
                      border: '1px solid rgba(245,166,35,0.25)',
                      borderRadius: 4,
                      padding: '2px 7px',
                    }}>
                      ✎ EDITADO: {new Date(m.edited_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                  <span style={{ flex: 1 }} />
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {new Date(m.played_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </span>
                  <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{isOpen ? '▲' : '▼'}</span>
                </div>

                {/* Expanded details */}
                {isOpen && (
                  <div style={{ borderTop: '1px solid var(--border)', padding: '14px 18px' }}>
                    {m.notes && (
                      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14, fontStyle: 'italic' }}>
                        "{m.notes}"
                      </p>
                    )}

                    {details.length === 0 ? (
                      <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Sin eventos registrados en esta partida.</p>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
                        {Object.values(byPlayer).map((pl, i) => (
                          <div key={i} style={{ background: 'var(--bg-surface)', borderRadius: 8, padding: 12, border: '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                              <span style={{ fontWeight: 600, fontSize: 14, color: pl.color || 'var(--text-primary)' }}>
                                {pl.name}
                              </span>
                              <span style={{
                                fontFamily: 'Rajdhani, sans-serif',
                                fontSize: 16,
                                fontWeight: 700,
                                color: pl.total > 0 ? 'var(--accent)' : pl.total < 0 ? 'var(--accent-green)' : 'var(--text-muted)'
                              }}>
                                {pl.total > 0 ? '+' : ''}{pl.total} 🫘
                              </span>
                            </div>
                            {pl.events.map((ev, j) => (
                              <div key={j} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', padding: '3px 0' }}>
                                <span>{ev.categories?.name}</span>
                                <span className={`points-pill ${ev.points > 0 ? 'pos' : 'neg'}`}>
                                  {ev.points > 0 ? '+' : ''}{ev.points}
                                </span>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}

                    <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                      <button
                        className="btn btn-sm"
                        style={{ borderColor: 'var(--accent-blue)', color: 'var(--accent-blue)' }}
                        onClick={e => { e.stopPropagation(); setEditingMatch(m) }}
                      >
                        ✎ Editar
                      </button>
                      <button className="btn btn-sm btn-danger" onClick={() => deleteMatch(m.id)}>
                        Eliminar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
