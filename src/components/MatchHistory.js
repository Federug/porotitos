import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import NewMatch from './NewMatch'

function getInitials(name) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  // If it's just a date (YYYY-MM-DD), parse directly to avoid timezone shift
  const dateOnly = String(dateStr).slice(0, 10)
  const [year, month, day] = dateOnly.split('-').map(Number)
  if (!year || !month || !day) return ''
  return `${String(day).padStart(2,'0')}/${String(month).padStart(2,'0')}/${year}`
}

export default function MatchHistory({ isAdmin = false }) {
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)
  const [matchDetails, setMatchDetails] = useState({})
  const [matchParticipants, setMatchParticipants] = useState({})
  const [editingMatch, setEditingMatch] = useState(null)
  const [allPlayers, setAllPlayers] = useState([])
  const dragItem = useRef(null)
  const dragOver = useRef(null)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const [{ data: m }, { data: p }] = await Promise.all([
      supabase.from('matches').select('*').order('sort_order', { ascending: true }).order('played_at', { ascending: false }),
      supabase.from('players').select('*')
    ])
    setMatches(m || [])
    setAllPlayers(p || [])
    setLoading(false)
  }

  async function loadDetails(matchId, force = false) {
    if (matchDetails[matchId] && !force) return
    const [{ data: events }, { data: participants }] = await Promise.all([
      supabase.from('match_events').select('*, players(name, avatar_color, photo_url), categories(name, points)').eq('match_id', matchId),
      supabase.from('match_players').select('player_id, players(name, avatar_color, photo_url)').eq('match_id', matchId)
    ])
    setMatchDetails(prev => ({ ...prev, [matchId]: events || [] }))
    setMatchParticipants(prev => ({ ...prev, [matchId]: participants || [] }))
  }

  async function deleteMatch(id) {
    if (!window.confirm('¿Eliminar esta partida?')) return
    await supabase.from('matches').delete().eq('id', id)
    setMatches(matches.filter(m => m.id !== id))
  }

  function toggleExpand(id) {
    if (expanded === id) { setExpanded(null); return }
    setExpanded(id)
    loadDetails(id)
  }

  function handleEditSaved() {
    setEditingMatch(null)
    loadAll()
    if (expanded) {
      setMatchDetails(prev => { const n = { ...prev }; delete n[expanded]; return n })
      loadDetails(expanded, true)
    }
  }

  // Drag and drop reorder
  function handleDragStart(e, index) {
    dragItem.current = index
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragEnter(e, index) {
    dragOver.current = index
    e.preventDefault()
  }

  async function handleDrop() {
    const from = dragItem.current
    const to = dragOver.current
    if (from === null || to === null || from === to) return

    const reordered = [...matches]
    const [moved] = reordered.splice(from, 1)
    reordered.splice(to, 0, moved)
    setMatches(reordered)

    // Persist sort order
    const updates = reordered.map((m, i) => supabase.from('matches').update({ sort_order: i }).eq('id', m.id))
    await Promise.all(updates)

    dragItem.current = null
    dragOver.current = null
  }

  if (loading) return <div className="loading">Cargando historial...</div>
  if (editingMatch) return <NewMatch editMatch={editingMatch} onSaved={handleEditSaved} />

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ marginBottom: 0 }}>📋 Historial de Partidas</h2>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>⠿ Arrastrá para reordenar</span>
      </div>

      {matches.length === 0 ? (
        <div className="empty"><div className="empty-icon">🎮</div><p>No hay partidas registradas todavía.</p></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {matches.map((m, index) => {
            const details = matchDetails[m.id] || []
            const participants = matchParticipants[m.id] || []
            const isOpen = expanded === m.id

            const byPlayer = {}
            details.forEach(e => {
              const pid = e.player_id
              if (!byPlayer[pid]) byPlayer[pid] = { name: e.players?.name, color: e.players?.avatar_color, photo: e.players?.photo_url, events: [], total: 0 }
              byPlayer[pid].events.push(e)
              byPlayer[pid].total += e.points
            })

            // Add participants with 0 porotos who didn't get events
            participants.forEach(mp => {
              if (!byPlayer[mp.player_id]) {
                byPlayer[mp.player_id] = {
                  name: mp.players?.name, color: mp.players?.avatar_color,
                  photo: mp.players?.photo_url, events: [], total: 0
                }
              }
            })

            return (
              <div
                key={m.id}
                className="card"
                style={{ padding: 0, overflow: 'hidden', cursor: 'grab' }}
                draggable
                onDragStart={e => handleDragStart(e, index)}
                onDragEnter={e => handleDragEnter(e, index)}
                onDragOver={e => e.preventDefault()}
                onDrop={handleDrop}
              >
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', cursor: 'pointer' }}
                  onClick={() => toggleExpand(m.id)}
                >
                  <span style={{ color: 'var(--text-muted)', fontSize: 16, cursor: 'grab', marginRight: 2 }}>⠿</span>
                  <span className={`badge ${m.result === 'victoria' ? 'badge-win' : m.result === 'derrota' ? 'badge-loss' : 'badge-draw'}`}>
                    {m.result === 'victoria' ? '✓ Victoria' : m.result === 'derrota' ? '✗ Derrota' : '= Empate'}
                  </span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'Rajdhani, sans-serif', fontSize: 16 }}>{m.map}</span>
                  {m.score_us != null && m.score_them != null && (
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{m.score_us} – {m.score_them}</span>
                  )}
                  {m.edited_at && (
                    <span style={{ fontSize: 11, color: 'var(--accent-amber)', background: 'rgba(245,166,35,0.1)', border: '1px solid rgba(245,166,35,0.25)', borderRadius: 4, padding: '2px 7px' }}>
                      ✎ EDITADO: {formatDate(m.edited_at)}
                    </span>
                  )}
                  <span style={{ flex: 1 }} />
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {formatDate(m.played_at)}
                  </span>
                  <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{isOpen ? '▲' : '▼'}</span>
                </div>

                {isOpen && (
                  <div style={{ borderTop: '1px solid var(--border)', padding: '14px 18px' }}>
                    {m.notes && <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14, fontStyle: 'italic' }}>"{m.notes}"</p>}

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                      {Object.entries(byPlayer).map(([pid, pl], i) => (
                        <div key={i} style={{ background: 'var(--bg-surface)', borderRadius: 8, padding: 12, border: '1px solid var(--border)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              {pl.photo
                                ? <img src={pl.photo} alt="" style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }} />
                                : <div className="player-avatar" style={{ width: 24, height: 24, fontSize: 10, background: pl.color + '22', color: pl.color, border: `1px solid ${pl.color}44` }}>{getInitials(pl.name || '?')}</div>
                              }
                              <span style={{ fontWeight: 600, fontSize: 13, color: pl.color || 'var(--text-primary)' }}>{pl.name}</span>
                            </div>
                            <span style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 16, fontWeight: 700, color: pl.total > 0 ? 'var(--accent)' : pl.total < 0 ? 'var(--accent-green)' : 'var(--text-muted)' }}>
                              {pl.total === 0 ? '0' : (pl.total > 0 ? '+' : '')}{pl.total} 🫘
                            </span>
                          </div>
                          {pl.events.length === 0
                            ? <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Sin porotos</div>
                            : pl.events.map((ev, j) => (
                              <div key={j} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', padding: '3px 0' }}>
                                <span>{ev.categories?.name}</span>
                                <span className={`points-pill ${ev.points > 0 ? 'pos' : 'neg'}`}>{ev.points > 0 ? '+' : ''}{ev.points}</span>
                              </div>
                            ))
                          }
                        </div>
                      ))}
                    </div>

                    <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                      <button className="btn btn-sm" style={{ borderColor: 'var(--accent-blue)', color: 'var(--accent-blue)' }}
                        onClick={e => { e.stopPropagation(); setEditingMatch(m) }}>✎ Editar</button>
                      {isAdmin && <button className="btn btn-sm btn-danger" onClick={() => deleteMatch(m.id)}>Eliminar</button>}
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
