import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import NewMatch from './NewMatch'

const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function getInitials(name) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const dateOnly = String(dateStr).slice(0, 10)
  const [year, month, day] = dateOnly.split('-').map(Number)
  if (!year || !month || !day) return ''
  return `${String(day).padStart(2,'0')}/${String(month).padStart(2,'0')}/${year}`
}

function parseYearMonth(dateStr) {
  const s = String(dateStr).slice(0, 10)
  const [y, m] = s.split('-').map(Number)
  return { year: y, month: m }
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

  // Filters
  const [filterYear, setFilterYear] = useState(-1)    // -1 = todos
  const [filterMonth, setFilterMonth] = useState(-1)  // -1 = todos
  const [filterResult, setFilterResult] = useState('') // '' = todos
  const [filterMap, setFilterMap] = useState('')
  const [filterPlayer, setFilterPlayer] = useState('')
  const [searchText, setSearchText] = useState('')
  const [collapsedMonths, setCollapsedMonths] = useState({})

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
    const updates = reordered.map((m, i) => supabase.from('matches').update({ sort_order: i }).eq('id', m.id))
    await Promise.all(updates)
    dragItem.current = null
    dragOver.current = null
  }

  function toggleMonthCollapse(key) {
    setCollapsedMonths(prev => ({ ...prev, [key]: !prev[key] }))
  }

  function clearFilters() {
    setFilterYear(-1); setFilterMonth(-1); setFilterResult('')
    setFilterMap(''); setFilterPlayer(''); setSearchText('')
  }

  // Available filter options
  const availableYears = [...new Set(matches.map(m => parseYearMonth(m.played_at).year))].filter(Boolean).sort((a,b) => b-a)
  const availableMaps = [...new Set(matches.map(m => m.map))].sort()
  const hasFilters = filterYear !== -1 || filterMonth !== -1 || filterResult !== '' || filterMap !== '' || filterPlayer !== '' || searchText !== ''

  // Apply filters
  const filtered = matches.filter(m => {
    const { year, month } = parseYearMonth(m.played_at)
    if (filterYear !== -1 && year !== filterYear) return false
    if (filterMonth !== -1 && month !== filterMonth) return false
    if (filterResult && m.result !== filterResult) return false
    if (filterMap && m.map !== filterMap) return false
    if (searchText && !m.map.toLowerCase().includes(searchText.toLowerCase()) &&
        !(m.notes || '').toLowerCase().includes(searchText.toLowerCase())) return false
    return true
  })

  // Group by year-month, then by day inside each month
  const groups = {}
  filtered.forEach((m) => {
    const { year, month } = parseYearMonth(m.played_at)
    const day = String(m.played_at).slice(8, 10).replace(/^0/, '')
    const monthKey = `${year}-${String(month).padStart(2,'0')}`
    const dayKey = `${monthKey}-${String(day).padStart(2,'0')}`
    if (!groups[monthKey]) groups[monthKey] = { year, month, label: `${MONTHS_ES[month-1]} ${year}`, days: {} }
    if (!groups[monthKey].days[dayKey]) {
      const weekday = (() => {
        const [y, mo, d] = String(m.played_at).slice(0,10).split('-').map(Number)
        const date = new Date(y, mo-1, d)
        return ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'][date.getDay()]
      })()
      groups[monthKey].days[dayKey] = { day: parseInt(day), month, year, weekday, matches: [] }
    }
    groups[monthKey].days[dayKey].matches.push({ ...m, _originalIndex: matches.indexOf(m) })
  })
  const sortedGroups = Object.entries(groups).sort((a,b) => b[0].localeCompare(a[0]))

  if (loading) return <div className="loading">Cargando historial...</div>
  if (editingMatch) return <NewMatch editMatch={editingMatch} onSaved={handleEditSaved} />

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', marginBottom:16 }}>
        <h2 style={{ marginBottom:0 }}>📋 Historial de Partidas</h2>
        <span style={{ flex:1 }} />
        <span style={{ fontSize:12, color:'var(--text-muted)' }}>⠿ Arrastrá para reordenar</span>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom:20, padding:'14px 18px' }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(130px, 1fr))', gap:10, alignItems:'flex-end' }}>
          <div>
            <div style={{ fontSize:11, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:5 }}>Año</div>
            <select value={filterYear} onChange={e => setFilterYear(parseInt(e.target.value))}>
              <option value={-1}>Todos</option>
              {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize:11, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:5 }}>Mes</div>
            <select value={filterMonth} onChange={e => setFilterMonth(parseInt(e.target.value))}>
              <option value={-1}>Todos</option>
              {MONTHS_ES.map((m,i) => <option key={i} value={i+1}>{m}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize:11, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:5 }}>Resultado</div>
            <select value={filterResult} onChange={e => setFilterResult(e.target.value)}>
              <option value="">Todos</option>
              <option value="victoria">✓ Victoria</option>
              <option value="derrota">✗ Derrota</option>
              <option value="empate">= Empate</option>
            </select>
          </div>
          <div>
            <div style={{ fontSize:11, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:5 }}>Mapa</div>
            <select value={filterMap} onChange={e => setFilterMap(e.target.value)}>
              <option value="">Todos</option>
              {availableMaps.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize:11, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:5 }}>Buscar</div>
            <input placeholder="Mapa, notas..." value={searchText} onChange={e => setSearchText(e.target.value)} />
          </div>
          {hasFilters && (
            <div style={{ display:'flex', alignItems:'flex-end' }}>
              <button className="btn btn-sm" onClick={clearFilters} style={{ width:'100%' }}>✕ Limpiar</button>
            </div>
          )}
        </div>

        {/* Stats row */}
        <div style={{ display:'flex', gap:16, marginTop:12, paddingTop:12, borderTop:'1px solid var(--border)', flexWrap:'wrap' }}>
          <span style={{ fontSize:12, color:'var(--text-muted)' }}>
            <span style={{ color:'var(--text-secondary)', fontWeight:600 }}>{filtered.length}</span> partidas
            {hasFilters && <span style={{ color:'var(--accent-amber)', marginLeft:6 }}>(filtradas)</span>}
          </span>
          <span style={{ fontSize:12, color:'var(--accent-green)' }}>
            ✓ {filtered.filter(m=>m.result==='victoria').length} victorias
          </span>
          <span style={{ fontSize:12, color:'var(--accent)' }}>
            ✗ {filtered.filter(m=>m.result==='derrota').length} derrotas
          </span>
          {filtered.filter(m=>m.result==='empate').length > 0 && (
            <span style={{ fontSize:12, color:'var(--accent-blue)' }}>
              = {filtered.filter(m=>m.result==='empate').length} empates
            </span>
          )}
          {filtered.length > 0 && (
            <span style={{ fontSize:12, color:'var(--text-muted)' }}>
              Win rate: <span style={{ color: filtered.filter(m=>m.result==='victoria').length/filtered.length >= 0.5 ? 'var(--accent-green)' : 'var(--accent)', fontWeight:600 }}>
                {Math.round(filtered.filter(m=>m.result==='victoria').length/filtered.length*100)}%
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
        <div style={{ display:'flex', flexDirection:'column', gap:24 }}>
          {sortedGroups.map(([groupKey, group]) => {
            const isMonthCollapsed = collapsedMonths[groupKey]
            const allMonthMatches = Object.values(group.days).flatMap(d => d.matches)
            const wins = allMonthMatches.filter(m=>m.result==='victoria').length
            const losses = allMonthMatches.filter(m=>m.result==='derrota').length
            const wr = allMonthMatches.length > 0 ? Math.round(wins/allMonthMatches.length*100) : 0
            const sortedDays = Object.entries(group.days).sort((a,b) => b[0].localeCompare(a[0]))

            return (
              <div key={groupKey}>
                {/* Month header */}
                <div
                  onClick={() => toggleMonthCollapse(groupKey)}
                  style={{
                    display:'flex', alignItems:'center', gap:12,
                    padding:'10px 16px', marginBottom: isMonthCollapsed ? 0 : 12,
                    background:'var(--bg-surface)', borderRadius:8,
                    border:'1px solid var(--border-bright)', cursor:'pointer',
                    userSelect:'none'
                  }}
                >
                  <span style={{ fontFamily:'Rajdhani,sans-serif', fontWeight:700, fontSize:17, color:'var(--text-primary)', flex:1 }}>
                    📅 {group.label}
                  </span>
                  <span style={{ fontSize:12, color:'var(--text-muted)' }}>{allMonthMatches.length} partidas</span>
                  <span style={{ fontSize:12, color:'var(--accent-green)' }}>{wins}V</span>
                  <span style={{ fontSize:12, color:'var(--accent)' }}>{losses}D</span>
                  <span style={{ fontSize:12, color: wr>=50?'var(--accent-green)':'var(--accent)', fontWeight:600, minWidth:42 }}>{wr}%</span>
                  <span style={{ color:'var(--text-muted)', fontSize:12, marginLeft:4 }}>{isMonthCollapsed ? '▼' : '▲'}</span>
                </div>

                {!isMonthCollapsed && (
                  <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                    {sortedDays.map(([dayKey, dayGroup]) => {
                      const isDayCollapsed = collapsedMonths[dayKey]
                      const dayWins = dayGroup.matches.filter(m=>m.result==='victoria').length
                      const dayLosses = dayGroup.matches.filter(m=>m.result==='derrota').length
                      const dayWR = dayGroup.matches.length > 0 ? Math.round(dayWins/dayGroup.matches.length*100) : 0

                      return (
                        <div key={dayKey} style={{ paddingLeft: 12, borderLeft: '2px solid var(--border)' }}>
                          {/* Day subheader */}
                          <div
                            onClick={() => toggleMonthCollapse(dayKey)}
                            style={{
                              display:'flex', alignItems:'center', gap:10,
                              padding:'7px 12px', marginBottom: isDayCollapsed ? 0 : 8,
                              background:'var(--bg-card)', borderRadius:6,
                              border:'1px solid var(--border)', cursor:'pointer',
                              userSelect:'none'
                            }}
                          >
                            <span style={{ fontSize:13, fontWeight:600, color:'var(--accent-blue)', minWidth:28 }}>
                              {String(dayGroup.day).padStart(2,'0')}
                            </span>
                            <span style={{ fontSize:12, color:'var(--text-muted)' }}>{dayGroup.weekday}</span>
                            <span style={{ flex:1 }} />
                            <span style={{ fontSize:11, color:'var(--text-muted)' }}>{dayGroup.matches.length} {dayGroup.matches.length===1?'partida':'partidas'}</span>
                            <span style={{ fontSize:11, color:'var(--accent-green)' }}>{dayWins}V</span>
                            <span style={{ fontSize:11, color:'var(--accent)' }}>{dayLosses}D</span>
                            <span style={{ fontSize:11, color: dayWR>=50?'var(--accent-green)':'var(--accent)', fontWeight:600 }}>{dayWR}%</span>
                            <span style={{ color:'var(--text-muted)', fontSize:11, marginLeft:4 }}>{isDayCollapsed ? '▼' : '▲'}</span>
                          </div>

                          {!isDayCollapsed && (
                            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                              {dayGroup.matches.map((m) => {
                      const index = m._originalIndex
                      const details = matchDetails[m.id] || []
                      const participants = matchParticipants[m.id] || []
                      const isOpen = expanded === m.id

                      const byPlayer = {}
                      details.forEach(e => {
                        const pid = e.player_id
                        if (!byPlayer[pid]) byPlayer[pid] = { name:e.players?.name, color:e.players?.avatar_color, photo:e.players?.photo_url, events:[], total:0 }
                        byPlayer[pid].events.push(e)
                        byPlayer[pid].total += e.points
                      })
                      participants.forEach(mp => {
                        if (!byPlayer[mp.player_id]) {
                          byPlayer[mp.player_id] = { name:mp.players?.name, color:mp.players?.avatar_color, photo:mp.players?.photo_url, events:[], total:0 }
                        }
                      })

                      return (
                        <div
                          key={m.id}
                          className="card"
                          style={{ padding:0, overflow:'hidden' }}
                          draggable
                          onDragStart={e => handleDragStart(e, index)}
                          onDragEnter={e => handleDragEnter(e, index)}
                          onDragOver={e => e.preventDefault()}
                          onDrop={handleDrop}
                        >
                          <div
                            style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 18px', cursor:'pointer' }}
                            onClick={() => toggleExpand(m.id)}
                          >
                            <span style={{ color:'var(--text-muted)', fontSize:16, cursor:'grab', marginRight:2 }}>⠿</span>
                            <span className={`badge ${m.result==='victoria'?'badge-win':m.result==='derrota'?'badge-loss':'badge-draw'}`}>
                              {m.result==='victoria'?'✓ Victoria':m.result==='derrota'?'✗ Derrota':'= Empate'}
                            </span>
                            <span style={{ fontWeight:600, color:'var(--text-primary)', fontFamily:'Rajdhani,sans-serif', fontSize:16 }}>{m.map}</span>
                            {m.score_us!=null && m.score_them!=null && (
                              <span style={{ fontSize:13, color:'var(--text-secondary)' }}>{m.score_us} – {m.score_them}</span>
                            )}
                            {m.edited_at && (
                              <span style={{ fontSize:11, color:'var(--accent-amber)', background:'rgba(245,166,35,0.1)', border:'1px solid rgba(245,166,35,0.25)', borderRadius:4, padding:'2px 7px' }}>
                                ✎ EDITADO: {formatDate(m.edited_at)}
                              </span>
                            )}
                            <span style={{ flex:1 }} />
                            <span style={{ fontSize:12, color:'var(--text-muted)' }}>{formatDate(m.played_at)}</span>
                            <span style={{ color:'var(--text-muted)', fontSize:12 }}>{isOpen?'▲':'▼'}</span>
                          </div>

                          {isOpen && (
                            <div style={{ borderTop:'1px solid var(--border)', padding:'14px 18px' }}>
                              {m.notes && <p style={{ fontSize:13, color:'var(--text-secondary)', marginBottom:14, fontStyle:'italic' }}>"{m.notes}"</p>}
                              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:10 }}>
                                {Object.entries(byPlayer).map(([pid, pl], i) => (
                                  <div key={i} style={{ background:'var(--bg-surface)', borderRadius:8, padding:12, border:'1px solid var(--border)' }}>
                                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                                        {pl.photo
                                          ? <img src={pl.photo} alt="" style={{ width:24, height:24, borderRadius:'50%', objectFit:'cover' }} />
                                          : <div className="player-avatar" style={{ width:24, height:24, fontSize:10, background:pl.color+'22', color:pl.color, border:`1px solid ${pl.color}44` }}>{getInitials(pl.name||'?')}</div>
                                        }
                                        <span style={{ fontWeight:600, fontSize:13, color:pl.color||'var(--text-primary)' }}>{pl.name}</span>
                                      </div>
                                      <span style={{ fontFamily:'Rajdhani,sans-serif', fontSize:16, fontWeight:700, color:pl.total>0?'var(--accent)':pl.total<0?'var(--accent-green)':'var(--text-muted)' }}>
                                        {pl.total===0?'0':(pl.total>0?'+':'')}{pl.total} 🫘
                                      </span>
                                    </div>
                                    {pl.events.length===0
                                      ? <div style={{ fontSize:11, color:'var(--text-muted)' }}>Sin porotos</div>
                                      : pl.events.map((ev,j) => (
                                        <div key={j} style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'var(--text-muted)', padding:'3px 0' }}>
                                          <span>{ev.categories?.name}</span>
                                          <span className={`points-pill ${ev.points>0?'pos':'neg'}`}>{ev.points>0?'+':''}{ev.points}</span>
                                        </div>
                                      ))
                                    }
                                  </div>
                                ))}
                              </div>
                              <div style={{ marginTop:14, display:'flex', justifyContent:'flex-end', gap:8 }}>
                                <button className="btn btn-sm" style={{ borderColor:'var(--accent-blue)', color:'var(--accent-blue)' }}
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
}
