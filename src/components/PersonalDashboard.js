import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Cell } from 'recharts'

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function parseDate(dateStr) {
  const s = String(dateStr).slice(0, 10)
  const [y, mo, d] = s.split('-').map(Number)
  return { year: y, month: mo - 1, day: d }
}

const TT = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:8, padding:'10px 14px' }}>
      <p style={{ fontSize:12, color:'var(--text-muted)', marginBottom:6 }}>{label}</p>
      {payload.map((p,i) => <p key={i} style={{ fontSize:13, color:p.color||'var(--text-primary)' }}>{p.name}: {p.value>0?'+':''}{p.value}</p>)}
    </div>
  )
}

function getInitials(n) { return n.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2) }

export default function PersonalDashboard() {
  const now = new Date()
  const [filterYear, setFilterYear] = useState(now.getFullYear())
  const [filterMonth, setFilterMonth] = useState(-1)
  const [selectedPlayer, setSelectedPlayer] = useState(null)
  const [players, setPlayers] = useState([])
  const [allMatches, setAllMatches] = useState([])
  const [allEvents, setAllEvents] = useState([])
  const [allMatchPlayers, setAllMatchPlayers] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const [{ data:p },{ data:m },{ data:e },{ data:c },{ data:mp }] = await Promise.all([
      supabase.from('players').select('*').order('name'),
      supabase.from('matches').select('*').order('played_at',{ascending:true}),
      supabase.from('match_events').select('*'),
      supabase.from('categories').select('*'),
      supabase.from('match_players').select('*'),
    ])
    setPlayers(p||[]); setAllMatches(m||[]); setAllEvents(e||[])
    setCategories(c||[]); setAllMatchPlayers(mp||[])
    if (p && p.length>0) setSelectedPlayer(p[0].id)
    setLoading(false)
  }

  const filteredMatches = allMatches.filter(m => {
    const { year: py, month: pmo } = parseDate(m.played_at)
    if (py!==filterYear) return false
    if (filterMonth!==-1 && pmo!==filterMonth) return false
    return true
  })
  const filteredMatchIds = new Set(filteredMatches.map(m=>m.id))
  const filteredEvents = allEvents.filter(e=>filteredMatchIds.has(e.match_id))
  const filteredMatchPlayers = allMatchPlayers.filter(mp=>filteredMatchIds.has(mp.match_id))

  const availableYears = [...new Set(allMatches.map(m=>parseDate(m.played_at).year))].sort((a,b)=>b-a)
  if (!availableYears.includes(now.getFullYear())) availableYears.unshift(now.getFullYear())

  const sp = players.find(p=>p.id===selectedPlayer)
  const spEvents = filteredEvents.filter(e=>e.player_id===selectedPlayer)
  const spMatchIds = new Set(filteredMatchPlayers.filter(mp=>mp.player_id===selectedPlayer).map(mp=>mp.match_id))
  const spMatches = filteredMatches.filter(m=>spMatchIds.has(m.id))

  const spTotal = spMatches.length
  const spWins = spMatches.filter(m=>m.result==='victoria').length
  const spWR = spTotal>0 ? Math.round((spWins/spTotal)*100) : 0
  const spTotalPts = spEvents.reduce((s,e)=>s+e.points,0)
  const spPPP = spTotal>0 ? (spTotalPts/spTotal).toFixed(2) : '0.00'

  // By map
  const byMap = {}
  spMatches.forEach(m => {
    const pts = spEvents.filter(e=>e.match_id===m.id).reduce((s,e)=>s+e.points,0)
    if (!byMap[m.map]) byMap[m.map]={ pts:0, count:0 }
    byMap[m.map].pts+=pts; byMap[m.map].count++
  })
  const mapData = Object.entries(byMap).map(([map,d])=>({ map, avg:parseFloat((d.pts/d.count).toFixed(2)), partidas:d.count })).sort((a,b)=>a.avg-b.avg)

  // By category
  const spCatCounts = {}
  spEvents.forEach(e=>{
    const cat = categories.find(c=>c.id===e.category_id)
    if (!cat) return
    if (!spCatCounts[cat.name]) spCatCounts[cat.name]={ count:0, points:cat.points }
    spCatCounts[cat.name].count++
  })
  const spCatData = Object.entries(spCatCounts).map(([name,d])=>({ name, count:d.count, points:d.points })).sort((a,b)=>b.count-a.count)

  // By day of month
  const byDay = {}
  spMatches.forEach(m=>{
    const day = parseDate(m.played_at).day
    const pts = spEvents.filter(e=>e.match_id===m.id).reduce((s,e)=>s+e.points,0)
    if (!byDay[day]) byDay[day]={ pts:0, count:0 }
    byDay[day].pts+=pts; byDay[day].count++
  })
  const dayData = Object.entries(byDay).map(([day,d])=>({ day:`${day}`, avg:parseFloat((d.pts/d.count).toFixed(2)) })).sort((a,b)=>parseInt(a.day)-parseInt(b.day))

  // By result
  const ptsByResult = {}
  spMatches.forEach(m=>{
    const pts = spEvents.filter(e=>e.match_id===m.id).reduce((s,e)=>s+e.points,0)
    ptsByResult[m.result]=(ptsByResult[m.result]||0)+pts
  })
  const resultData = [
    { name:'Victoria', value:ptsByResult.victoria||0 },
    { name:'Derrota', value:ptsByResult.derrota||0 },
    { name:'Empate', value:ptsByResult.empate||0 },
  ].filter(r=>r.value!==0)

  // Trend over time (per match)
  const trendData = spMatches.slice(-15).map(m => ({
    date: String(parseDate(m.played_at).day).padStart(2,'0')+'/'+String(parseDate(m.played_at).month+1).padStart(2,'0'),
    porotos: spEvents.filter(e=>e.match_id===m.id).reduce((s,e)=>s+e.points,0),
    resultado: m.result==='victoria'?1:m.result==='derrota'?-1:0
  }))

  // vs team avg
  const allPlayersPPP = players.map(p=>{
    const pEvts = filteredEvents.filter(e=>e.player_id===p.id)
    const mCount = new Set(filteredMatchPlayers.filter(mp=>mp.player_id===p.id).map(mp=>mp.match_id)).size
    return mCount>0 ? pEvts.reduce((s,e)=>s+e.points,0)/mCount : 0
  })
  const teamAvgPPP = allPlayersPPP.length>0 ? (allPlayersPPP.reduce((s,v)=>s+v,0)/allPlayersPPP.length).toFixed(2) : '0'

  const playersSorted = players.map(p=>{
    const pEvts = filteredEvents.filter(e=>e.player_id===p.id)
    const mCount = new Set(filteredMatchPlayers.filter(mp=>mp.player_id===p.id).map(mp=>mp.match_id)).size
    const ppp = mCount>0 ? pEvts.reduce((s,e)=>s+e.points,0)/mCount : 0
    return { ...p, ppp }
  }).sort((a,b)=>a.ppp-b.ppp)
  const rank = playersSorted.findIndex(p=>p.id===selectedPlayer)+1

  if (loading) return <div className="loading">Cargando stats...</div>

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:24 }}>
        <h2 style={{ marginBottom:0 }}>👤 Stats Personales</h2>
        <span style={{ flex:1 }} />
        <select value={selectedPlayer||''} onChange={e=>setSelectedPlayer(e.target.value)} style={{ width:160 }}>
          {players.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={filterYear} onChange={e=>setFilterYear(parseInt(e.target.value))} style={{ width:100 }}>
          {availableYears.map(y=><option key={y} value={y}>{y}</option>)}
        </select>
        <select value={filterMonth} onChange={e=>setFilterMonth(parseInt(e.target.value))} style={{ width:130 }}>
          <option value={-1}>Todo el año</option>
          {MONTHS.map((m,i)=><option key={i} value={i}>{m}</option>)}
        </select>
      </div>

      {sp && (
        <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:20, padding:'14px 20px', background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:12 }}>
          {sp.photo_url
            ? <img src={sp.photo_url} alt="" style={{ width:52, height:52, borderRadius:'50%', objectFit:'cover', border:`2px solid ${sp.avatar_color}` }} />
            : <div className="player-avatar" style={{ width:52, height:52, fontSize:18, background:sp.avatar_color+'22', color:sp.avatar_color, border:`2px solid ${sp.avatar_color}55` }}>{getInitials(sp.name)}</div>
          }
          <div>
            <div style={{ fontFamily:'Rajdhani,sans-serif', fontSize:22, fontWeight:700, color:sp.avatar_color }}>{sp.name}</div>
            <div style={{ fontSize:12, color:'var(--text-muted)' }}>Ranking #{rank} del equipo</div>
          </div>
        </div>
      )}

      <div className="stat-grid" style={{ marginBottom:16 }}>
        <div className="stat-card"><div className="stat-label">Partidas</div><div className="stat-value blue">{spTotal}</div></div>
        <div className="stat-card"><div className="stat-label">Win Rate</div><div className={`stat-value ${spWR>=50?'green':'red'}`}>{spWR}%</div></div>
        <div className="stat-card"><div className="stat-label">Porotos totales</div><div className={`stat-value ${spTotalPts>0?'red':spTotalPts<0?'green':''}`}>{spTotalPts>0?'+':''}{spTotalPts} 🫘</div></div>
        <div className="stat-card"><div className="stat-label">🫘 / Partida</div><div className={`stat-value ${parseFloat(spPPP)>0?'red':parseFloat(spPPP)<0?'green':''}`}>{parseFloat(spPPP)>0?'+':''}{spPPP}</div></div>
        <div className="stat-card"><div className="stat-label">Prom. equipo</div><div className="stat-value">{parseFloat(teamAvgPPP)>0?'+':''}{teamAvgPPP}</div></div>
        <div className="stat-card"><div className="stat-label">Ranking</div><div className="stat-value" style={{ color:'var(--accent-amber)' }}>#{rank}</div></div>
      </div>

      {spTotal===0 ? (
        <div className="empty"><div className="empty-icon">🫘</div><p>Sin partidas en el período seleccionado.</p></div>
      ) : (
        <>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
            {mapData.length>0 && (
              <div className="card">
                <h3>🗺️ 🫘/partida por mapa</h3>
                <div style={{ height:200 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={mapData}>
                      <XAxis dataKey="map" tick={{ fill:'var(--text-muted)', fontSize:10 }} />
                      <YAxis tick={{ fill:'var(--text-muted)', fontSize:11 }} />
                      <Tooltip content={<TT />} />
                      <Bar dataKey="avg" name="🫘/partida" radius={[4,4,0,0]}>
                        {mapData.map((d,i)=><Cell key={i} fill={d.avg<=0?'#22d3a5':'#ff4655'} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
            {spCatData.length>0 && (
              <div className="card">
                <h3>🏷️ Mis categorías</h3>
                <div style={{ height:200 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={spCatData} layout="vertical">
                      <XAxis type="number" tick={{ fill:'var(--text-muted)', fontSize:11 }} />
                      <YAxis type="category" dataKey="name" tick={{ fill:'var(--text-secondary)', fontSize:11 }} width={90} />
                      <Tooltip content={<TT />} />
                      <Bar dataKey="count" name="Veces" radius={[0,4,4,0]}>
                        {spCatData.map((d,i)=><Cell key={i} fill={d.points>0?'#ff4655':'#22d3a5'} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
            {trendData.length>1 && (
              <div className="card">
                <h3>📈 Porotos por partida (tendencia)</h3>
                <div style={{ height:200 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="date" tick={{ fill:'var(--text-muted)', fontSize:10 }} />
                      <YAxis tick={{ fill:'var(--text-muted)', fontSize:11 }} />
                      <Tooltip content={<TT />} />
                      <Line type="monotone" dataKey="porotos" name="🫘" stroke={sp?.avatar_color||'#5b8af5'} strokeWidth={2} dot={{ r:3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
            {dayData.length>1 && (
              <div className="card">
                <h3>📅 🫘/partida por día del mes</h3>
                <div style={{ height:200 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dayData}>
                      <XAxis dataKey="day" tick={{ fill:'var(--text-muted)', fontSize:11 }} />
                      <YAxis tick={{ fill:'var(--text-muted)', fontSize:11 }} />
                      <Tooltip content={<TT />} />
                      <Bar dataKey="avg" name="🫘/partida" radius={[4,4,0,0]}>
                        {dayData.map((d,i)=><Cell key={i} fill={d.avg<=0?'#22d3a5':'#ff4655'} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>

          {resultData.length>0 && (
            <div className="card">
              <h3>⚔️ Porotos según resultado de la partida</h3>
              <div style={{ height:160 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={resultData} layout="vertical">
                    <XAxis type="number" tick={{ fill:'var(--text-muted)', fontSize:11 }} />
                    <YAxis type="category" dataKey="name" tick={{ fill:'var(--text-secondary)', fontSize:12 }} width={70} />
                    <Tooltip content={<TT />} />
                    <Bar dataKey="value" name="Porotos" radius={[0,4,4,0]}>
                      {resultData.map((d,i)=><Cell key={i} fill={d.name==='Victoria'?'#22d3a5':d.name==='Derrota'?'#ff4655':'#5b8af5'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
