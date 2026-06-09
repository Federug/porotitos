import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Legend, Cell } from 'recharts'

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const COLORS = ['#ff4655','#22d3a5','#5b8af5','#f5a623','#c084fc','#fb923c']

function getInitials(n) { return n.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2) }
function parseDate(s) { const [y,mo,d] = String(s).slice(0,10).split('-').map(Number); return {year:y,month:mo,day:d} }

const TT = ({ active, payload, label }) => {
  if (!active||!payload?.length) return null
  return (
    <div style={{background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:8,padding:'10px 14px'}}>
      <p style={{fontSize:12,color:'var(--text-muted)',marginBottom:6}}>{label}</p>
      {payload.map((p,i)=><p key={i} style={{fontSize:13,color:p.color||'var(--text-primary)'}}>{p.name}: {typeof p.value==='number'&&p.value>0?'+':''}{typeof p.value==='number'?Number(p.value.toFixed(2)):p.value}</p>)}
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

  useEffect(()=>{ loadAll() },[])

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
    const {year,month} = parseDate(m.played_at)
    if (year!==filterYear) return false
    if (filterMonth!==-1 && month!==filterMonth) return false
    return true
  })
  const filteredMatchIds = new Set(filteredMatches.map(m=>m.id))
  const filteredEvents = allEvents.filter(e=>filteredMatchIds.has(e.match_id))
  const filteredMatchPlayers = allMatchPlayers.filter(mp=>filteredMatchIds.has(mp.match_id))

  const availableYears = [...new Set(allMatches.map(m=>parseDate(m.played_at).year))].filter(Boolean).sort((a,b)=>b-a)
  if (!availableYears.includes(now.getFullYear())) availableYears.unshift(now.getFullYear())

  const wins = filteredMatches.filter(m=>m.result==='victoria').length
  const losses = filteredMatches.filter(m=>m.result==='derrota').length
  const total = filteredMatches.length
  const winRate = total>0 ? Math.round((wins/total)*100) : 0

  // Streak calculation (uses ALL matches, not filtered, ordered by sort_order)
  const recentMatches = [...allMatches].sort((a,b) => a.sort_order - b.sort_order || String(a.played_at).localeCompare(String(b.played_at)))
  let streak = 0
  let streakType = ''
  if (recentMatches.length > 0) {
    const last = recentMatches[recentMatches.length - 1].result
    streakType = last
    for (let i = recentMatches.length - 1; i >= 0; i--) {
      if (recentMatches[i].result === last) streak++
      else break
    }
  }

  // Player table
  const playerTable = players.map(p => {
    const pEvents = filteredEvents.filter(e=>e.player_id===p.id)
    const totalPts = pEvents.reduce((s,e)=>s+e.points,0)
    const matchesPlayed = new Set(filteredMatchPlayers.filter(mp=>mp.player_id===p.id).map(mp=>mp.match_id)).size
    const ppp = matchesPlayed>0 ? parseFloat((totalPts/matchesPlayed).toFixed(2)) : 0
    return { ...p, totalPts, matchesPlayed, ppp }
  }).sort((a,b)=>a.ppp-b.ppp)

  // Category breakdown (count + ratio per player total matches)
  const totalMatchesAllPlayers = total
  const catData = categories.map(c => {
    const count = filteredEvents.filter(e=>e.category_id===c.id).length
    const ratio = totalMatchesAllPlayers>0 ? parseFloat((count/totalMatchesAllPlayers).toFixed(2)) : 0
    return { name:c.name, count, ratio, points:c.points }
  }).filter(c=>c.count>0).sort((a,b)=>b.count-a.count).slice(0,8)

  // Porotos por mapa (avg per match on that map)
  const mapStats = {}
  filteredMatches.forEach(m => {
    if (!mapStats[m.map]) mapStats[m.map] = { pts:0, count:0, wins:0 }
    const pts = filteredEvents.filter(e=>e.match_id===m.id).reduce((s,e)=>s+e.points,0)
    mapStats[m.map].pts += pts
    mapStats[m.map].count++
    if (m.result==='victoria') mapStats[m.map].wins++
  })
  const mapData = Object.entries(mapStats).map(([map,d])=>({
    map, avg:parseFloat((d.pts/d.count).toFixed(2)),
    partidas:d.count, wr:Math.round((d.wins/d.count)*100)
  })).sort((a,b)=>a.avg-b.avg)

  // Porotos positivos vs negativos por mapa
  const mapPosNeg = Object.entries(mapStats).map(([map,d]) => {
    const mIds = filteredMatches.filter(m=>m.map===map).map(m=>m.id)
    const mEvents = filteredEvents.filter(e=>mIds.includes(e.match_id))
    const pos = mEvents.filter(e=>e.points>0).reduce((s,e)=>s+e.points,0)
    const neg = Math.abs(mEvents.filter(e=>e.points<0).reduce((s,e)=>s+e.points,0))
    return { map, positivos:pos, negativos:neg, partidas:d.count }
  }).sort((a,b)=>b.partidas-a.partidas)

  // Category ratio per match (how many per game on average)
  const catRatioData = categories.map(c => {
    const count = filteredEvents.filter(e=>e.category_id===c.id).length
    const ratio = total>0 ? parseFloat((count/total).toFixed(3)) : 0
    return { name:c.name, ratio, count, points:c.points }
  }).filter(c=>c.count>0).sort((a,b)=>b.ratio-a.ratio).slice(0,8)

  // Trend
  const trendMatches = filteredMatches.slice(-10)
  const trendData = trendMatches.map(m => {
    const entry = { date:String(m.played_at).slice(5,10).replace('-','/') }
    players.forEach(p => {
      entry[p.name] = filteredEvents.filter(e=>e.match_id===m.id&&e.player_id===p.id).reduce((s,e)=>s+e.points,0)
    })
    return entry
  })

  if (loading) return <div className="loading">Cargando dashboard...</div>

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:24}}>
        <h2 style={{marginBottom:0}}>📊 Dashboard del Equipo</h2>
        <span style={{flex:1}}/>
        <select value={filterYear} onChange={e=>setFilterYear(parseInt(e.target.value))} style={{width:100}}>
          {availableYears.map(y=><option key={y} value={y}>{y}</option>)}
        </select>
        <select value={filterMonth} onChange={e=>setFilterMonth(parseInt(e.target.value))} style={{width:130}}>
          <option value={-1}>Todo el año</option>
          {MONTHS.map((m,i)=><option key={i} value={i+1}>{m}</option>)}
        </select>
      </div>

      <div className="stat-grid" style={{marginBottom:20}}>
        <div className="stat-card"><div className="stat-label">Partidas</div><div className="stat-value blue">{total}</div></div>
        <div className="stat-card"><div className="stat-label">Victorias</div><div className="stat-value green">{wins}</div></div>
        <div className="stat-card"><div className="stat-label">Derrotas</div><div className="stat-value red">{losses}</div></div>
        <div className="stat-card"><div className="stat-label">Win Rate</div><div className={`stat-value ${winRate>=50?'green':'red'}`}>{winRate}%</div></div>
        {streak>0 && (
          <div className="stat-card" style={{border:`1px solid ${streakType==='victoria'?'rgba(34,211,165,0.3)':'rgba(255,70,85,0.3)'}`,background:streakType==='victoria'?'rgba(34,211,165,0.05)':'rgba(255,70,85,0.05)'}}>
            <div className="stat-label">Racha actual</div>
            <div className="stat-value" style={{color:streakType==='victoria'?'var(--accent-green)':'var(--accent)',fontSize:22}}>
              {streakType==='victoria'?'🟢':'🔴'} {streak}
            </div>
            <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>{streakType==='victoria'?'victorias':'derrotas'} seguidas</div>
          </div>
        )}
      </div>

      {playerTable.length>0 && (
        <div className="card" style={{marginBottom:16}}>
          <h3>🏆 Tabla de Porotitos</h3>
          <table>
            <thead><tr><th>#</th><th>Jugador</th><th>Porotos totales</th><th>Partidas</th><th style={{color:'var(--accent-blue)'}}>🫘/Partida ↑</th></tr></thead>
            <tbody>
              {playerTable.map((p,i)=>(
                <tr key={p.id}>
                  <td style={{color:i===0?'var(--accent-amber)':'var(--text-muted)',fontFamily:'Rajdhani',fontWeight:700}}>#{i+1}</td>
                  <td>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      {p.photo_url ? <img src={p.photo_url} alt="" style={{width:28,height:28,borderRadius:'50%',objectFit:'cover'}}/>
                        : <div className="player-avatar" style={{width:28,height:28,fontSize:11,background:p.avatar_color+'22',color:p.avatar_color,border:`1px solid ${p.avatar_color}44`}}>{getInitials(p.name)}</div>}
                      <span style={{color:'var(--text-primary)',fontWeight:500}}>{p.name}</span>
                    </div>
                  </td>
                  <td style={{color:p.totalPts>0?'var(--accent)':p.totalPts<0?'var(--accent-green)':'var(--text-muted)',fontFamily:'Rajdhani',fontSize:16,fontWeight:700}}>{p.totalPts>0?'+':''}{p.totalPts} 🫘</td>
                  <td>{p.matchesPlayed}</td>
                  <td style={{color:p.ppp>0?'var(--accent)':p.ppp<0?'var(--accent-green)':'var(--text-muted)',fontFamily:'Rajdhani',fontSize:16,fontWeight:700}}>{p.ppp>0?'+':''}{p.ppp}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{fontSize:11,color:'var(--text-muted)',marginTop:10}}>↑ Más negativo = mejor rendimiento.</p>
        </div>
      )}

      {total>0 && (
        <>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
            {/* Map avg porotos */}
            {mapData.length>0 && (
              <div className="card">
                <h3>🗺️ 🫘/partida por mapa</h3>
                <div style={{height:220}}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={mapData}>
                      <XAxis dataKey="map" tick={{fill:'var(--text-muted)',fontSize:10}}/>
                      <YAxis tick={{fill:'var(--text-muted)',fontSize:11}}/>
                      <Tooltip content={<TT/>}/>
                      <Bar dataKey="avg" name="🫘/partida" radius={[4,4,0,0]}>
                        {mapData.map((d,i)=><Cell key={i} fill={d.avg<=0?'#22d3a5':'#ff4655'}/>)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Map pos vs neg */}
            {mapPosNeg.length>0 && (
              <div className="card">
                <h3>🗺️ Porotos + y − por mapa</h3>
                <div style={{height:220}}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={mapPosNeg}>
                      <XAxis dataKey="map" tick={{fill:'var(--text-muted)',fontSize:10}}/>
                      <YAxis tick={{fill:'var(--text-muted)',fontSize:11}}/>
                      <Tooltip content={<TT/>}/>
                      <Legend wrapperStyle={{fontSize:11}}/>
                      <Bar dataKey="positivos" name="➕ Porotos" fill="#ff4655" radius={[4,4,0,0]}/>
                      <Bar dataKey="negativos" name="➖ Porotos" fill="#22d3a5" radius={[4,4,0,0]}/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
            {/* Category count */}
            {catData.length>0 && (
              <div className="card">
                <h3>🏷️ Categorías más frecuentes</h3>
                <div style={{height:220}}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={catData} layout="vertical" margin={{left:0,right:30}}>
                      <XAxis type="number" tick={{fill:'var(--text-muted)',fontSize:11}}/>
                      <YAxis type="category" dataKey="name" tick={{fill:'var(--text-secondary)',fontSize:11}} width={90}/>
                      <Tooltip content={<TT/>}/>
                      <Bar dataKey="count" name="Veces" radius={[0,4,4,0]}>
                        {catData.map((c,i)=><Cell key={i} fill={c.points>0?'#ff4655':'#22d3a5'}/>)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Category ratio/partida */}
            {catRatioData.length>0 && (
              <div className="card">
                <h3>🏷️ Frecuencia por partida (ratio)</h3>
                <div style={{height:220}}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={catRatioData} layout="vertical" margin={{left:0,right:50}}>
                      <XAxis type="number" tick={{fill:'var(--text-muted)',fontSize:11}}/>
                      <YAxis type="category" dataKey="name" tick={{fill:'var(--text-secondary)',fontSize:11}} width={90}/>
                      <Tooltip content={<TT/>}/>
                      <Bar dataKey="ratio" name="por partida" radius={[0,4,4,0]}>
                        {catRatioData.map((c,i)=><Cell key={i} fill={c.points>0?'#ff4655':'#22d3a5'}/>)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>

          {trendData.length>1 && (
            <div className="card">
              <h3>📈 Porotos por partida — últimas 10</h3>
              <div style={{height:220}}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData} margin={{top:5,right:20,bottom:5}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/>
                    <XAxis dataKey="date" tick={{fill:'var(--text-muted)',fontSize:11}}/>
                    <YAxis tick={{fill:'var(--text-muted)',fontSize:11}}/>
                    <Tooltip content={<TT/>}/>
                    <Legend wrapperStyle={{fontSize:12}}/>
                    {players.map((p,i)=><Line key={p.id} type="monotone" dataKey={p.name} stroke={p.avatar_color||COLORS[i%COLORS.length]} strokeWidth={2} dot={{r:3}}/>)}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </>
      )}

      {total===0 && <div className="empty"><div className="empty-icon">🫘</div><p>Sin partidas en el período seleccionado.</p></div>}
    </div>
  )
}
