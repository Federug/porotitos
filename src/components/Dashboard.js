import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Legend, Cell } from 'recharts'

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const COLORS = ['#ff4655','#22d3a5','#5b8af5','#f5a623','#c084fc','#fb923c']

function getInitials(n) { return n.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2) }

const TT = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:8, padding:'10px 14px' }}>
      <p style={{ fontSize:12, color:'var(--text-muted)', marginBottom:6 }}>{label}</p>
      {payload.map((p,i) => <p key={i} style={{ fontSize:13, color:p.color||'var(--text-primary)' }}>{p.name}: {p.value>0?'+':''}{p.value}</p>)}
    </div>
  )
}

export default function Dashboard() {
  const now = new Date()
  const [filterYear, setFilterYear] = useState(now.getFullYear())
  const [filterMonth, setFilterMonth] = useState(-1)
  const [players, setPlayers] = useState([])
  const [allMatches, setAllMatches] = useState([])
  const [allEvents, setAllEvents] = useState([])
  const [allMatchPlayers, setAllMatchPlayers] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [{ data:p },{ data:m },{ data:e },{ data:c },{ data:mp }] = await Promise.all([
      supabase.from('players').select('*'),
      supabase.from('matches').select('*').order('sort_order',{ascending:true}).order('played_at',{ascending:true}),
      supabase.from('match_events').select('*'),
      supabase.from('categories').select('*'),
      supabase.from('match_players').select('*'),
    ])
    setPlayers(p||[]); setAllMatches(m||[]); setAllEvents(e||[])
    setCategories(c||[]); setAllMatchPlayers(mp||[])
    setLoading(false)
  }

  const filteredMatches = allMatches.filter(m => {
    const d = new Date(m.played_at+'T12:00:00')
    if (d.getFullYear() !== filterYear) return false
    if (filterMonth !== -1 && d.getMonth() !== filterMonth) return false
    return true
  })
  const filteredMatchIds = new Set(filteredMatches.map(m=>m.id))
  const filteredEvents = allEvents.filter(e=>filteredMatchIds.has(e.match_id))
  const filteredMatchPlayers = allMatchPlayers.filter(mp=>filteredMatchIds.has(mp.match_id))

  const availableYears = [...new Set(allMatches.map(m=>new Date(m.played_at+'T12:00:00').getFullYear()))].sort((a,b)=>b-a)
  if (!availableYears.includes(now.getFullYear())) availableYears.unshift(now.getFullYear())

  const wins = filteredMatches.filter(m=>m.result==='victoria').length
  const losses = filteredMatches.filter(m=>m.result==='derrota').length
  const total = filteredMatches.length
  const winRate = total>0 ? Math.round((wins/total)*100) : 0

  // Player table - use match_players for matches played count
  const playerTable = players.map(p => {
    const pEvents = filteredEvents.filter(e=>e.player_id===p.id)
    const totalPts = pEvents.reduce((s,e)=>s+e.points,0)
    const matchesPlayed = new Set(filteredMatchPlayers.filter(mp=>mp.player_id===p.id).map(mp=>mp.match_id)).size
    const ppp = matchesPlayed>0 ? parseFloat((totalPts/matchesPlayed).toFixed(2)) : 0
    return { ...p, totalPts, matchesPlayed, ppp }
  }).sort((a,b)=>a.ppp-b.ppp)

  // Category breakdown
  const catCounts = {}
  filteredEvents.forEach(e=>{ catCounts[e.category_id]=(catCounts[e.category_id]||0)+1 })
  const catBreakdown = categories.map(c=>({ name:c.name, count:catCounts[c.id]||0, points:c.points }))
    .filter(c=>c.count>0).sort((a,b)=>b.count-a.count).slice(0,8)

  const trendMatches = filteredMatches.slice(-10)
  const trendData = trendMatches.map(m => {
    const entry = { date: new Date(m.played_at+'T12:00:00').toLocaleDateString('es-AR',{day:'2-digit',month:'2-digit'}) }
    players.forEach(p => {
      const pts = filteredEvents.filter(e=>e.match_id===m.id&&e.player_id===p.id).reduce((s,e)=>s+e.points,0)
      entry[p.name] = pts
    })
    return entry
  })

  if (loading) return <div className="loading">Cargando dashboard...</div>

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:24 }}>
        <h2 style={{ marginBottom:0 }}>📊 Dashboard del Equipo</h2>
        <span style={{ flex:1 }} />
        <select value={filterYear} onChange={e=>setFilterYear(parseInt(e.target.value))} style={{ width:100 }}>
          {availableYears.map(y=><option key={y} value={y}>{y}</option>)}
        </select>
        <select value={filterMonth} onChange={e=>setFilterMonth(parseInt(e.target.value))} style={{ width:130 }}>
          <option value={-1}>Todo el año</option>
          {MONTHS.map((m,i)=><option key={i} value={i}>{m}</option>)}
        </select>
      </div>

      <div className="stat-grid" style={{ marginBottom:20 }}>
        <div className="stat-card"><div className="stat-label">Partidas</div><div className="stat-value blue">{total}</div></div>
        <div className="stat-card"><div className="stat-label">Victorias</div><div className="stat-value green">{wins}</div></div>
        <div className="stat-card"><div className="stat-label">Derrotas</div><div className="stat-value red">{losses}</div></div>
        <div className="stat-card"><div className="stat-label">Win Rate</div><div className={`stat-value ${winRate>=50?'green':'red'}`}>{winRate}%</div></div>
      </div>

      {playerTable.length>0 && (
        <div className="card" style={{ marginBottom:16 }}>
          <h3>🏆 Tabla de Porotitos</h3>
          <table>
            <thead><tr><th>#</th><th>Jugador</th><th>Porotos totales</th><th>Partidas</th><th style={{ color:'var(--accent-blue)' }}>🫘 / Partida ↑</th></tr></thead>
            <tbody>
              {playerTable.map((p,i)=>(
                <tr key={p.id}>
                  <td style={{ color:i===0?'var(--accent-amber)':'var(--text-muted)', fontFamily:'Rajdhani', fontWeight:700 }}>#{i+1}</td>
                  <td>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      {p.photo_url
                        ? <img src={p.photo_url} alt="" style={{ width:28, height:28, borderRadius:'50%', objectFit:'cover' }} />
                        : <div className="player-avatar" style={{ width:28, height:28, fontSize:11, background:p.avatar_color+'22', color:p.avatar_color, border:`1px solid ${p.avatar_color}44` }}>{getInitials(p.name)}</div>
                      }
                      <span style={{ color:'var(--text-primary)', fontWeight:500 }}>{p.name}</span>
                    </div>
                  </td>
                  <td style={{ color:p.totalPts>0?'var(--accent)':p.totalPts<0?'var(--accent-green)':'var(--text-muted)', fontFamily:'Rajdhani', fontSize:16, fontWeight:700 }}>{p.totalPts>0?'+':''}{p.totalPts} 🫘</td>
                  <td>{p.matchesPlayed}</td>
                  <td style={{ color:p.ppp>0?'var(--accent)':p.ppp<0?'var(--accent-green)':'var(--text-muted)', fontFamily:'Rajdhani', fontSize:16, fontWeight:700 }}>{p.ppp>0?'+':''}{p.ppp}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ fontSize:11, color:'var(--text-muted)', marginTop:10 }}>↑ Ordenado por 🫘/partida. Más negativo = mejor rendimiento.</p>
        </div>
      )}

      {total>0 && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          <div className="card">
            <h3>📊 Categorías más frecuentes</h3>
            <div style={{ height:220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={catBreakdown} layout="vertical" margin={{ left:0, right:20 }}>
                  <XAxis type="number" tick={{ fill:'var(--text-muted)', fontSize:11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fill:'var(--text-secondary)', fontSize:11 }} width={90} />
                  <Tooltip content={<TT />} />
                  <Bar dataKey="count" name="Veces" radius={[0,4,4,0]}>
                    {catBreakdown.map((c,i)=><Cell key={i} fill={c.points>0?'#ff4655':'#22d3a5'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          {trendData.length>1 && (
            <div className="card">
              <h3>📈 Porotos por partida (últimas 10)</h3>
              <div style={{ height:220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData} margin={{ top:5, right:20, bottom:5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="date" tick={{ fill:'var(--text-muted)', fontSize:11 }} />
                    <YAxis tick={{ fill:'var(--text-muted)', fontSize:11 }} />
                    <Tooltip content={<TT />} />
                    <Legend wrapperStyle={{ fontSize:12 }} />
                    {players.map((p,i)=><Line key={p.id} type="monotone" dataKey={p.name} stroke={COLORS[i%COLORS.length]} strokeWidth={2} dot={{ r:3 }} />)}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      {total===0 && !loading && (
        <div className="empty"><div className="empty-icon">🫘</div><p>Sin partidas en el período seleccionado.</p></div>
      )}
    </div>
  )
}
