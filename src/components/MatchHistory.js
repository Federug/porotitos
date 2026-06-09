import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import NewMatch from './NewMatch'

const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function getInitials(name) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const s = String(dateStr).slice(0, 10)
  const [year, month, day] = s.split('-').map(Number)
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

  const [filterYear, setFilterYear] = useState(-1)
  const [filterMonth, setFilterMonth] = useState(-1)
  const [filterResult, setFilterResult] = useState('')
  const [filterMap, setFilterMap] = useState('')
  const [searchText, setSearchText] = useState('')
  const [collapsedSections, setCollapsedSections] = useState({})

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const [{ data: m }, { data: p }] = await Promise.all([
      supabase.from('matches').select('*').order('sort_order', { ascending: true }).order('played_at', { ascending: false }).order('id', { ascending: false }),
      supabase.from('players').select('*').order('name')
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
    setMatches(prev => prev.filter(m => m.id !== id))
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
    await Promise.all(reordered.map((m, i) => supabase.from('matches').update({ sort_order: i }).eq('id', m.id)))
    dragItem.current = null
    dragOver.current = null
  }

  function toggleSection(key) {
    setCollapsedSections(prev => ({ ...prev, [key]: !prev[key] }))
  }

  function clearFilters() {
    setFilterYear(-1); setFilterMonth(-1); setFilterResult('')
    setFilterMap(''); setSearchText('')
  }

  const availableYears = [...new Set(matches.map(m => parseInt(String(m.played_at).slice(0, 4))))].filter(Boolean).sort((a, b) => b - a)
  const availableMaps = [...new Set(matches.map(m => m.map))].sort()
  const hasFilters = filterYear !== -1 || filterMonth !== -1 || filterResult !== '' || filterMap !== '' || searchText !== ''

  const filtered = matches.filter(m => {
    const s = String(m.played_at).slice(0, 10)
    const [y, mo] = s.split('-').map(Number)
    if (filterYear !== -1 && y !== filterYear) return false
    if (filterMonth !== -1 && mo !== filterMonth) return false
    if (filterResult && m.result !== filterResult) return false
    if (filterMap && m.map !== filterMap) return false
    if (searchText && !m.map.toLowerCase().includes(searchText.toLowerCase()) && !(m.notes || '').toLowerCase().includes(searchText.toLowerCase())) return false
    return true
  })

  // Group by month → day
  const monthGroups = {}
  filtered.forEach(m => {
    const s = String(m.played_at).slice(0, 10)
    const [y, mo, d] = s.split('-').map(Number)
    if (!y || !mo || !d) return
    const monthKey = `${y}-${String(mo).padStart(2, '0')}`
    const dayKey = `${monthKey}-${String(d).padStart(2, '0')}`
    if (!monthGroups[monthKey]) {
      monthGroups[monthKey] = {
        label: `${MONTHS_ES[mo - 1]} ${y}`,
        days: {}
      }
    }
    if (!monthGroups[monthKey].days[dayKey]) {
      const date = new Date(y, mo - 1, d)
      const weekday = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][date.getDay()]
      monthGroups[monthKey].days[dayKey] = { d, weekday, matches: [] }
    }
    monthGroups[monthKey].days[dayKey].matches.push({ ...m, _idx: matches.indexOf(m) })
  })

  const sortedMonths = Object.entries(monthGroups).sort((a, b) => b[0].localeCompare(a[0]))

  if (loading) return <div className="loading">Cargando historial...</div>
  if (editingMatch) return <NewMatch editMatch={editingMatch} onSaved={handleEditSaved} />

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ marginBottom: 0 }}>📋 Historial de Partidas</h2>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>⠿ Arrastrá para reordenar</span>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 20, padding: '14px 18px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, alignItems: 'flex-end' }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5 }}>Año</div>
            <select value={filterYear} onChange={e => setFilterYear(parseInt(e.target.value))}>
              <option value={-1}>Todos</option>
              {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5 }}>Mes</div>
            <select value={filterMonth} onChange={e => setFilterMonth(parseInt(e.target.value))}>
              <option value={-1}>Todos</option>
              {MONTHS_ES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5 }}>Resultado</div>
            <select value={filterResult} onChange={e => setFilterResult(e.target.value)}>
              <option value="">Todos</option>
              <option value="victoria">✓ Victoria</option>
              <option value="derrota">✗ Derrota</option>
              <option value="empate">= Empate</option>
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5 }}>Mapa</div>
            <select value={filterMap} onChange={e => setFilterMap(e.target.value)}>
              <option value="">Todos</option>
              {availableMaps.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5 }}>Buscar</div>
            <input placeholder="Mapa, notas..." value={searchText} onChange={e => setSearchText(e.target.value)} />
          </div>
          {hasFilters && (
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button className="btn btn-sm" onClick={clearFilters} style={{ width: '100%' }}>✕ Limpiar</button>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{filtered.length}</span> partidas
            {hasFilters && <span style={{ color: 'var(--accent-amber)', marginLeft: 6 }}>(filtradas)</span>}
          </span>
          <span style={{ fontSize: 12, color: 'var(--accent-green)' }}>✓ {filtered.filter(m => m.result === 'victoria').length} victorias</span>
          <span style={{ fontSize: 12, color: 'var(--accent)' }}>✗ {filtered.filter(m => m.result === 'derrota').length} derrotas</span>
          {filtered.length > 0 && (
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Win rate: <span style={{ color: filtered.filter(m => m.result === 'victoria').length / filtered.length >= 0.5 ? 'var(--accent-green)' : 'var(--accent)', fontWeight: 600 }}>
                {Math.round(filtered.filter(m => m.result === 'victoria').length / filtered.length * 100)}%
              </span>
            </span>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">🔍</div>
          <p>{hasFilters ? 'No hay partidas con esos filtros.' : 'No hay partidas registradas todavía.'}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {sortedMonths.map(([monthKey, monthGroup]) => {
            const allMonthMatches = Object.values(monthGroup.days).flatMap(d => d.matches)
            const mWins = allMonthMatches.filter(m => m.result === 'victoria').length
            const mLosses = allMonthMatches.filter(m => m.result === 'derrota').length
            const mWR = allMonthMatches.length > 0 ? Math.round(mWins / allMonthMatches.length * 100) : 0
            const isMonthCollapsed = collapsedSections[monthKey]
            const sortedDays = Object.entries(monthGroup.days).sort((a, b) => b[0].localeCompare(a[0]))

            return (
              <div key={monthKey}>
                {/* Month header */}
                <div
                  onClick={() => toggleSection(monthKey)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', marginBottom: isMonthCollapsed ? 0 : 10, background: 'var(--bg-surface)', borderRadius: 8, border: '1px solid var(--border-bright)', cursor: 'pointer', userSelect: 'none' }}
                >
                  <span style={{ fontFamily: 'Rajdhani,sans-serif', fontWeight: 700, fontSize: 17, color: 'var(--text-primary)', flex: 1 }}>
                    📅 {monthGroup.label}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{allMonthMatches.length} partidas</span>
                  <span style={{ fontSize: 12, color: 'var(--accent-green)' }}>{mWins}V</span>
                  <span style={{ fontSize: 12, color: 'var(--accent)' }}>{mLosses}D</span>
                  <span style={{ fontSize: 12, color: mWR >= 50 ? 'var(--accent-green)' : 'var(--accent)', fontWeight: 600, minWidth: 42 }}>{mWR}%</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{isMonthCollapsed ? '▼' : '▲'}</span>
                </div>

                {!isMonthCollapsed && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {sortedDays.map(([dayKey, dayGroup]) => {
                      const isDayCollapsed = dayKey in collapsedSections ? collapsedSections[dayKey] : true  // days collapsed by default
                      const dWins = dayGroup.matches.filter(m => m.result === 'victoria').length
                      const dLosses = dayGroup.matches.filter(m => m.result === 'derrota').length
                      const dWR = dayGroup.matches.length > 0 ? Math.round(dWins / dayGroup.matches.length * 100) : 0

                      return (
                        <div key={dayKey} style={{ paddingLeft: 12, borderLeft: '2px solid var(--border)' }}>
                          {/* Day header */}
                          <div
                            onClick={() => toggleSection(dayKey)}
                            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px', marginBottom: isDayCollapsed ? 0 : 8, background: 'var(--bg-card)', borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer', userSelect: 'none' }}
                          >
                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-blue)', minWidth: 28 }}>
                              {String(dayGroup.d).padStart(2, '0')}
                            </span>
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{dayGroup.weekday}</span>
                            <span style={{ flex: 1 }} />
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{dayGroup.matches.length} {dayGroup.matches.length === 1 ? 'partida' : 'partidas'}</span>
                            <span style={{ fontSize: 11, color: 'var(--accent-green)' }}>{dWins}V</span>
                            <span style={{ fontSize: 11, color: 'var(--accent)' }}>{dLosses}D</span>
                            <span style={{ fontSize: 11, color: dWR >= 50 ? 'var(--accent-green)' : 'var(--accent)', fontWeight: 600 }}>{dWR}%</span>
                            <span style={{ color: 'var(--text-muted)', fontSize: 11, marginLeft: 4 }}>{isDayCollapsed ? '▼' : '▲'}</span>
                          </div>

                          {!isDayCollapsed && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              {dayGroup.matches.map(m => {
                                const index = m._idx
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
                                participants.forEach(mp => {
                                  if (!byPlayer[mp.player_id]) {
                                    byPlayer[mp.player_id] = { name: mp.players?.name, color: mp.players?.avatar_color, photo: mp.players?.photo_url, events: [], total: 0 }
                                  }
                                })

                                return (
                                  <div
                                    key={m.id}
                                    className="card"
                                    style={{ padding: 0, overflow: 'hidden' }}
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
                                      <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'Rajdhani,sans-serif', fontSize: 16 }}>{m.map}</span>
                                      {m.score_us != null && m.score_them != null && (
                                        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{m.score_us} – {m.score_them}</span>
                                      )}
                                      {m.edited_at && (
                                        <span style={{ fontSize: 11, color: 'var(--accent-amber)', background: 'rgba(245,166,35,0.1)', border: '1px solid rgba(245,166,35,0.25)', borderRadius: 4, padding: '2px 7px' }}>
                                          ✎ EDITADO: {formatDate(m.edited_at)}
                                        </span>
                                      )}
                                      <span style={{ flex: 1 }} />
                                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatDate(m.played_at)}</span>
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
                                                <span style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: 16, fontWeight: 700, color: pl.total > 0 ? 'var(--accent)' : pl.total < 0 ? 'var(--accent-green)' : 'var(--text-muted)' }}>
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
                    })}
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
