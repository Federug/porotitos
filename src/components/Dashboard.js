import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis, Cell
} from 'recharts'

const COLORS = ['#ff4655', '#22d3a5', '#5b8af5', '#f5a623', '#c084fc', '#fb923c']
const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function getInitials(name) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

const TT = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px' }}>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ fontSize: 13, color: p.color || 'var(--text-primary)' }}>
          {p.name}: {typeof p.value === 'number' && p.value > 0 ? '+' : ''}{p.value}
        </p>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const now = new Date()
  const [filterYear, setFilterYear] = useState(now.getFullYear())
  const [filterMonth, setFilterMonth] = useState(-1) // -1 = all
  const [selectedPlayer, setSelectedPlayer] = useState(null)

  const [players, setPlayers] = useState([])
  const [allMatches, setAllMatches] = useState([])
  const [allEvents, setAllEvents] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [{ data: p }, { data: m }, { data: e }, { data: c }] = await Promise.all([
      supabase.from('players').select('*'),
      supabase.from('matches').select('*').order('played_at', { ascending: true }),
      supabase.from('match_events').select('*'),
      supabase.from('categories').select('*'),
    ])
    setPlayers(p || [])
    setAllMatches(m || [])
    setAllEvents(e || [])
    setCategories(c || [])
    if (p && p.length > 0) setSelectedPlayer(p[0].id)
    setLoading(false)
  }

  // Filter helpers
  const filteredMatches = allMatches.filter(m => {
    const d = new Date(m.played_at)
    if (d.getFullYear() !== filterYear) return false
    if (filterMonth !== -1 && d.getMonth() !== filterMonth) return false
    return true
  })
  const filteredMatchIds = new Set(filteredMatches.map(m => m.id))
  const filteredEvents = allEvents.filter(e => filteredMatchIds.has(e.match_id))

  const availableYears = [...new Set(allMatches.map(m => new Date(m.played_at).getFullYear()))].sort((a,b) => b-a)
  if (!availableYears.includes(now.getFullYear())) availableYears.unshift(now.getFullYear())

  // --- TEAM STATS ---
  const wins = filteredMatches.filter(m => m.result === 'victoria').length
  const losses = filteredMatches.filter(m => m.result === 'derrota').length
  const total = filteredMatches.length
  const winRate = total > 0 ? Math.round((wins / total) * 100) : 0

  // Player stats table
  const playerTable = players.map(p => {
    const pEvents = filteredEvents.filter(e => e.player_id === p.id)
    const totalPts = pEvents.reduce((s, e) => s + e.points, 0)
    // Count matches this player participated in (has at least one event)
    const matchesPlayed = new Set(pEvents.map(e => e.match_id)).size
    const ppp = matchesPlayed > 0 ? (totalPts / matchesPlayed).toFixed(2) : '0.00'
    return { ...p, totalPts, matchesPlayed, ppp: parseFloat(ppp) }
  }).sort((a, b) => a.ppp - b.ppp) // best (most negative) first

  // Category breakdown
  const catCounts = {}
  filteredEvents.forEach(e => { catCounts[e.category_id] = (catCounts[e.category_id] || 0) + 1 })
  const catBreakdown = categories
    .map(c => ({ name: c.name, count: catCounts[c.id] || 0, points: c.points }))
    .filter(c => c.count > 0).sort((a, b) => b.count - a.count).slice(0, 8)

  // Trend (last 10 matches in filter)
  const trendMatches = filteredMatches.slice(-10)
  const trendData = trendMatches.map(m => {
    const entry = { date: new Date(m.played_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) }
    players.forEach(p => {
      const pEvts = filteredEvents.filter(e => e.match_id === m.id && e.player_id === p.id)
      entry[p.name] = pEvts.reduce((s, e) => s + e.points, 0)
    })
    return entry
  })

  // --- PERSONAL STATS ---
  const sp = players.find(p => p.id === selectedPlayer)
  const spEvents = filteredEvents.filter(e => e.player_id === selectedPlayer)
  const spMatchIds = [...new Set(spEvents.map(e => e.match_id))]
  const spMatches = filteredMatches.filter(m => spMatchIds.includes(m.id))

  // Porotos by map
  const byMap = {}
  spMatches.forEach(m => {
    const mEvts = spEvents.filter(e => e.match_id === m.id)
    const pts = mEvts.reduce((s, e) => s + e.points, 0)
    byMap[m.map] = { pts: (byMap[m.map]?.pts || 0) + pts, count: (byMap[m.map]?.count || 0) + 1 }
  })
  const mapData = Object.entries(byMap).map(([map, d]) => ({
    map, total: d.pts, avg: parseFloat((d.pts / d.count).toFixed(2)), partidas: d.count
  })).sort((a, b) => a.avg - b.avg)

  // Porotos by category (personal)
  const spCatCounts = {}
  spEvents.forEach(e => {
    const cat = categories.find(c => c.id === e.category_id)
    if (!cat) return
    if (!spCatCounts[cat.name]) spCatCounts[cat.name] = { count: 0, points: cat.points, total: 0 }
    spCatCounts[cat.name].count++
    spCatCounts[cat.name].total += e.points
  })
  const spCatData = Object.entries(spCatCounts)
    .map(([name, d]) => ({ name, count: d.count, total: d.total, points: d.points }))
    .sort((a, b) => b.count - a.count)

  // Porotos/partida por día del mes
  const byDay = {}
  spMatches.forEach(m => {
    const day = new Date(m.played_at).getDate()
    const mEvts = spEvents.filter(e => e.match_id === m.id)
    const pts = mEvts.reduce((s, e) => s + e.points, 0)
    if (!byDay[day]) byDay[day] = { pts: 0, count: 0 }
    byDay[day].pts += pts
    byDay[day].count++
  })
  const dayData = Object.entries(byDay).map(([day, d]) => ({
    day: `Día ${day}`, avg: parseFloat((d.pts / d.count).toFixed(2))
  })).sort((a, b) => parseInt(a.day.split(' ')[1]) - parseInt(b.day.split(' ')[1]))

  // Win/loss personal
  const spWins = spMatches.filter(m => m.result === 'victoria').length
  const spTotal = spMatches.length
  const spWR = spTotal > 0 ? Math.round((spWins / spTotal) * 100) : 0
  const spTotalPts = spEvents.reduce((s, e) => s + e.points, 0)
  const spPPP = spTotal > 0 ? (spTotalPts / spTotal).toFixed(2) : '0.00'

  // Porotos by result
  const ptsByResult = { victoria: 0, derrota: 0, empate: 0 }
  spMatches.forEach(m => {
    const pts = spEvents.filter(e => e.match_id === m.id).reduce((s, e) => s + e.points, 0)
    ptsByResult[m.result] = (ptsByResult[m.result] || 0) + pts
  })
  const resultData = [
    { name: 'Victoria', value: ptsByResult.victoria },
    { name: 'Derrota', value: ptsByResult.derrota },
    { name: 'Empate', value: ptsByResult.empate },
  ].filter(r => r.value !== 0)

  if (loading) return <div className="loading">Cargando dashboard...</div>

  return (
    <div>
      {/* Filters */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <h2 style={{ marginBottom: 0 }}>📊 Dashboard</h2>
        <span style={{ flex: 1 }} />
        <select value={filterYear} onChange={e => setFilterYear(parseInt(e.target.value))} style={{ width: 100 }}>
          {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={filterMonth} onChange={e => setFilterMonth(parseInt(e.target.value))} style={{ width: 130 }}>
          <option value={-1}>Todo el año</option>
          {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
        </select>
      </div>

      {/* Team stats */}
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card"><div className="stat-label">Partidas</div><div className="stat-value blue">{total}</div></div>
        <div className="stat-card"><div className="stat-label">Victorias</div><div className="stat-value green">{wins}</div></div>
        <div className="stat-card"><div className="stat-label">Derrotas</div><div className="stat-value red">{losses}</div></div>
        <div className="stat-card"><div className="stat-label">Win Rate</div><div className={`stat-value ${winRate >= 50 ? 'green' : 'red'}`}>{winRate}%</div></div>
      </div>

      {/* Player table */}
      {playerTable.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3>🏆 Tabla de Porotitos</h3>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Jugador</th>
                <th>Porotos totales</th>
                <th>Partidas jugadas</th>
                <th style={{ color: 'var(--accent-blue)' }}>🫘 / Partida ↑</th>
              </tr>
            </thead>
            <tbody>
              {playerTable.map((p, i) => (
                <tr key={p.id}>
                  <td style={{ color: i === 0 ? 'var(--accent-amber)' : 'var(--text-muted)', fontFamily: 'Rajdhani', fontWeight: 700 }}>#{i + 1}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className="player-avatar" style={{ width: 28, height: 28, fontSize: 11, background: p.avatar_color + '22', color: p.avatar_color, border: `1px solid ${p.avatar_color}44` }}>
                        {getInitials(p.name)}
                      </div>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{p.name}</span>
                    </div>
                  </td>
                  <td style={{ color: p.totalPts > 0 ? 'var(--accent)' : p.totalPts < 0 ? 'var(--accent-green)' : 'var(--text-muted)', fontFamily: 'Rajdhani', fontSize: 16, fontWeight: 700 }}>
                    {p.totalPts > 0 ? '+' : ''}{p.totalPts} 🫘
                  </td>
                  <td>{p.matchesPlayed}</td>
                  <td style={{ color: p.ppp > 0 ? 'var(--accent)' : p.ppp < 0 ? 'var(--accent-green)' : 'var(--text-muted)', fontFamily: 'Rajdhani', fontSize: 16, fontWeight: 700 }}>
                    {p.ppp > 0 ? '+' : ''}{p.ppp}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10 }}>↑ Ordenado por porotos/partida. Más negativo = mejor rendimiento.</p>
        </div>
      )}

      {/* Charts row */}
      {total > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div className="card">
            <h3>📊 Categorías más frecuentes</h3>
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={catBreakdown} layout="vertical" margin={{ left: 0, right: 20 }}>
                  <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} width={90} />
                  <Tooltip content={<TT />} />
                  <Bar dataKey="count" name="Veces" radius={[0, 4, 4, 0]}>
                    {catBreakdown.map((c, i) => <Cell key={i} fill={c.points > 0 ? '#ff4655' : '#22d3a5'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {trendData.length > 1 && (
            <div className="card">
              <h3>📈 Porotos por partida (últimas 10)</h3>
              <div style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData} margin={{ top: 5, right: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                    <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                    <Tooltip content={<TT />} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    {players.map((p, i) => (
                      <Line key={p.id} type="monotone" dataKey={p.name} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={{ r: 3 }} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      {/* PERSONAL STATS */}
      {players.length > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '28px 0 16px' }}>
            <h2 style={{ marginBottom: 0 }}>👤 Stats Personales</h2>
            <select
              value={selectedPlayer || ''}
              onChange={e => setSelectedPlayer(e.target.value)}
              style={{ width: 160 }}
            >
              {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          {sp && (
            <>
              {/* Personal stat cards */}
              <div className="stat-grid" style={{ marginBottom: 16 }}>
                <div className="stat-card"><div className="stat-label">Partidas</div><div className="stat-value blue">{spTotal}</div></div>
                <div className="stat-card"><div className="stat-label">Win Rate</div><div className={`stat-value ${spWR >= 50 ? 'green' : 'red'}`}>{spWR}%</div></div>
                <div className="stat-card"><div className="stat-label">Porotos totales</div><div className={`stat-value ${spTotalPts > 0 ? 'red' : spTotalPts < 0 ? 'green' : ''}`}>{spTotalPts > 0 ? '+' : ''}{spTotalPts} 🫘</div></div>
                <div className="stat-card"><div className="stat-label">🫘 / Partida</div><div className={`stat-value ${parseFloat(spPPP) > 0 ? 'red' : parseFloat(spPPP) < 0 ? 'green' : ''}`}>{parseFloat(spPPP) > 0 ? '+' : ''}{spPPP}</div></div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                {/* By map */}
                {mapData.length > 0 && (
                  <div className="card">
                    <h3>🗺️ Porotos por mapa</h3>
                    <div style={{ height: 200 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={mapData}>
                          <XAxis dataKey="map" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                          <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                          <Tooltip content={<TT />} />
                          <Bar dataKey="avg" name="🫘/partida" radius={[4, 4, 0, 0]}>
                            {mapData.map((d, i) => <Cell key={i} fill={d.avg <= 0 ? '#22d3a5' : '#ff4655'} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* By category */}
                {spCatData.length > 0 && (
                  <div className="card">
                    <h3>🏷️ Mis categorías</h3>
                    <div style={{ height: 200 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={spCatData} layout="vertical">
                          <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                          <YAxis type="category" dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} width={90} />
                          <Tooltip content={<TT />} />
                          <Bar dataKey="count" name="Veces" radius={[0, 4, 4, 0]}>
                            {spCatData.map((d, i) => <Cell key={i} fill={d.points > 0 ? '#ff4655' : '#22d3a5'} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                {/* By day of month */}
                {dayData.length > 1 && (
                  <div className="card">
                    <h3>📅 Porotos/partida por día del mes</h3>
                    <div style={{ height: 200 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dayData}>
                          <XAxis dataKey="day" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                          <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                          <Tooltip content={<TT />} />
                          <Bar dataKey="avg" name="🫘/partida" radius={[4, 4, 0, 0]}>
                            {dayData.map((d, i) => <Cell key={i} fill={d.avg <= 0 ? '#22d3a5' : '#ff4655'} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* By result */}
                {resultData.length > 0 && (
                  <div className="card">
                    <h3>⚔️ Porotos por resultado</h3>
                    <div style={{ height: 200 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={resultData}>
                          <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
                          <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                          <Tooltip content={<TT />} />
                          <Bar dataKey="value" name="Porotos" radius={[4, 4, 0, 0]}>
                            {resultData.map((d, i) => (
                              <Cell key={i} fill={d.name === 'Victoria' ? '#22d3a5' : d.name === 'Derrota' ? '#ff4655' : '#5b8af5'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </div>

              {/* Comparison vs team average */}
              {spTotal > 0 && playerTable.length > 1 && (
                <div className="card">
                  <h3>📊 {sp.name} vs promedio del equipo</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
                    {(() => {
                      const teamAvgPPP = playerTable.reduce((s, p) => s + p.ppp, 0) / playerTable.length
                      const rank = playerTable.findIndex(p => p.id === selectedPlayer) + 1
                      const bestInMatch = filteredMatches.reduce((best, m) => {
                        const pts = spEvents.filter(e => e.match_id === m.id).reduce((s, e) => s + e.points, 0)
                        return pts < best ? pts : best
                      }, 0)
                      const worstInMatch = filteredMatches.reduce((worst, m) => {
                        const pts = spEvents.filter(e => e.match_id === m.id).reduce((s, e) => s + e.points, 0)
                        return pts > worst ? pts : worst
                      }, 0)
                      return [
                        { label: 'Ranking equipo', value: `#${rank}`, color: rank === 1 ? 'var(--accent-amber)' : 'var(--text-primary)' },
                        { label: 'Su 🫘/partida', value: spPPP, color: parseFloat(spPPP) <= 0 ? 'var(--accent-green)' : 'var(--accent)' },
                        { label: 'Prom. equipo', value: teamAvgPPP.toFixed(2), color: 'var(--text-secondary)' },
                        { label: 'Mejor partida', value: `${bestInMatch} 🫘`, color: 'var(--accent-green)' },
                        { label: 'Peor partida', value: `+${worstInMatch} 🫘`, color: 'var(--accent)' },
                      ]
                    })().map((item, i) => (
                      <div key={i} style={{ background: 'var(--bg-surface)', borderRadius: 8, padding: '12px 14px', border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: 4 }}>{item.label}</div>
                        <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 22, fontWeight: 700, color: item.color }}>{item.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {total === 0 && !loading && (
        <div className="empty">
          <div className="empty-icon">🫘</div>
          <p>Sin partidas en el período seleccionado.</p>
        </div>
      )}
    </div>
  )
}
