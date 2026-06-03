import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend, Cell } from 'recharts'

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const COLORS = ['#ff4655','#22d3a5','#5b8af5','#f5a623','#c084fc','#fb923c']

function getInitials(n) { return n.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2) }

const TT = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:8, padding:'10px 14px' }}>
      <p style={{ fontSize:12, color:'var(--text-muted)', marginBottom:6 }}>{label}</p>
      {payload.map((p,i) => <p key={i} style={{ fontSize:13, color:p.color||'var(--text-primary)' }}>{p.name}: {typeof p.value==='number'&&p.value>0?'+':''}{typeof p.value==='number'?p.value.toFixed(2):p.value}</p>)}
    </div>
  )
}

export default function ComparativeDashboard() {
  const now = new Date()
  const [filterYear, setFilterYear] = useState(now.getFullYear())
  const [filterMonth, setFilterMonth] = useState(-1)
  const [players, setPlayers] = useState([])
  const [selectedPlayers, setSelectedPlayers] = useState([])
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
    if (p && p.length>=2) setSelectedPlayers(p.slice(0,2).map(pl=>pl.id))
    else if (p && p.length===1) setSelectedPlayers([p[0].id])
    setLoading(false)
  }

  function togglePlayer(pid) {
    setSelectedPlayers(prev => prev.includes(pid) ? prev.filter(id=>id!==pid) : [...prev, pid])
  }

  const filteredMatches = allMatches.filter(m => {
    const d = new Date(m.played_at+'T12:00:00')
    if (d.getFullYear()!==filterYear) return false
    if (filterMonth!==-1 && d.getMonth()!==filterMonth) return false
    return true
  })
  const filteredMatchIds = new Set(filteredMatches.map(m=>m.id))
  const filteredEvents = allEvents.filter(e=>filteredMatchIds.has(e.match_id))
  const filteredMatchPlayers = allMatchPlayers.filter(mp=>filteredMatchIds.has(mp.match_id))

  const availableYears = [...new Set(allMatches.map(m=>new Date(m.played_at+'T12:00:00').getFullYear()))].sort((a,b)=>b-a)
  if (!availableYears.includes(now.getFullYear())) availableYears.unshift(now.getFullYear())

  const activePlayers = players.filter(p=>selectedPlayers.includes(p.id))

  // Per-player stats
  function getPlayerStats(pid) {
    const pEvents = filteredEvents.filter(e=>e.player_id===pid)
    const matchIds = new Set(filteredMatchPlayers.filter(mp=>mp.player_id===pid).map(mp=>mp.match_id))
    const pMatches = filteredMatches.filter(m=>matchIds.has(m.id))
    const totalPts = pEvents.reduce((s,e)=>s+e.points,0)
    const matchCount = pMatches.length
    const ppp = matchCount>0 ? totalPts/matchCount : 0
    const wins = pMatches.filter(m=>m.result==='victoria').length
    const wr = matchCount>0 ? Math.round((wins/matchCount)*100) : 0

    // by map
    const byMap = {}
    pMatches.forEach(m => {
      const pts = pEvents.filter(e=>e.match_id===m.id).reduce((s,e)=>s+e.points,0)
      if (!byMap[m.map]) byMap[m.map]={pts:0,count:0}
      byMap[m.map].pts+=pts; byMap[m.map].count++
    })

    // by category
    const byCat = {}
    pEvents.forEach(e=>{
      const cat = categories.find(c=>c.id===e.category_id)
      if (!cat) return
      byCat[cat.name]=(byCat[cat.name]||0)+1
    })

    return { pid, totalPts, matchCount, ppp, wr, byMap, byCat }
  }

  const statsMap = {}
  activePlayers.forEach(p=>{ statsMap[p.id]=getPlayerStats(p.id) })

  // Summary table data
  const summaryRows = [
    { label:'Partidas jugadas', key:'matchCount', format: v=>v, higherBetter: true },
    { label:'Win Rate %', key:'wr', format: v=>v+'%', higherBetter: true },
    { label:'Porotos totales', key:'totalPts', format: v=>(v>0?'+':'')+v+' 🫘', higherBetter: false },
    { label:'🫘 / Partida', key:'ppp', format: v=>(v>0?'+':'')+v.toFixed(2), higherBetter: false },
  ]

  // PPP comparison bar chart
  const pppData = activePlayers.map((p,i)=>({
    name: p.name,
    ppp: parseFloat((statsMap[p.id]?.ppp||0).toFixed(2)),
    color: p.avatar_color || COLORS[i%COLORS.length]
  }))

  // Category comparison - all cats that appear for any selected player
  const allCatNames = [...new Set(activePlayers.flatMap(p=>Object.keys(statsMap[p.id]?.byCat||{})))]
  const catCompData = allCatNames.map(catName => {
    const entry = { cat: catName }
    activePlayers.forEach(p => { entry[p.name] = statsMap[p.id]?.byCat[catName]||0 })
    return entry
  }).sort((a,b)=>{
    const totalA = activePlayers.reduce((s,p)=>s+(a[p.name]||0),0)
    const totalB = activePlayers.reduce((s,p)=>s+(b[p.name]||0),0)
    return totalB-totalA
  }).slice(0,10)

  // Map comparison - maps where at least one player participated
  const allMaps = [...new Set(activePlayers.flatMap(p=>Object.keys(statsMap[p.id]?.byMap||{})))]
  const mapCompData = allMaps.map(map => {
    const entry = { map }
    activePlayers.forEach(p => {
      const d = statsMap[p.id]?.byMap[map]
      entry[p.name] = d ? parseFloat((d.pts/d.count).toFixed(2)) : null
    })
    return entry
  }).sort((a,b)=>a.map.localeCompare(b.map))

  // Radar data - normalize metrics for radar
  const radarMetrics = ['🫘/Partida','Win Rate','Clutches','MVPs','Aces']
  function getRadarValue(pid, metric) {
    const st = statsMap[pid]
    if (!st) return 0
    if (metric==='🫘/Partida') {
      // Invert: more negative = better = higher radar value
      const min = -5, max = 5
      return Math.max(0, Math.min(100, ((max-st.ppp)/(max-min))*100))
    }
    if (metric==='Win Rate') return st.wr
    const catMap = { 'Clutches':'Clutch', 'MVPs':'MVP', 'Aces':'Ace' }
    const catName = catMap[metric]
    const count = st.byCat[catName]||0
    const maxCount = Math.max(1, ...activePlayers.map(p=>statsMap[p.id]?.byCat[catName]||0))
    return Math.round((count/maxCount)*100)
  }

  const radarData = radarMetrics.map(metric => {
    const entry = { metric }
    activePlayers.forEach(p => { entry[p.name]=getRadarValue(p.id, metric) })
    return entry
  })

  if (loading) return <div className="loading">Cargando comparativo...</div>

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
        <h2 style={{ marginBottom:0 }}>⚔️ Dashboard Comparativo</h2>
        <span style={{ flex:1 }} />
        <select value={filterYear} onChange={e=>setFilterYear(parseInt(e.target.value))} style={{ width:100 }}>
          {availableYears.map(y=><option key={y} value={y}>{y}</option>)}
        </select>
        <select value={filterMonth} onChange={e=>setFilterMonth(parseInt(e.target.value))} style={{ width:130 }}>
          <option value={-1}>Todo el año</option>
          {MONTHS.map((m,i)=><option key={i} value={i}>{m}</option>)}
        </select>
      </div>

      {/* Player selector */}
      <div className="card" style={{ marginBottom:20 }}>
        <h3>Seleccionar jugadores a comparar</h3>
        <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
          {players.map((p,i) => {
            const sel = selectedPlayers.includes(p.id)
            const color = p.avatar_color || COLORS[i%COLORS.length]
            return (
              <button key={p.id} onClick={()=>togglePlayer(p.id)} style={{
                padding:'7px 14px', borderRadius:20,
                border:`2px solid ${sel?color:'var(--border)'}`,
                background: sel ? color+'22' : 'transparent',
                color: sel ? color : 'var(--text-secondary)',
                fontWeight: sel?600:400, fontSize:13, cursor:'pointer',
                display:'flex', alignItems:'center', gap:6,
                transition:'all 0.15s'
              }}>
                {p.photo_url
                  ? <img src={p.photo_url} alt="" style={{ width:18, height:18, borderRadius:'50%', objectFit:'cover' }} />
                  : <div style={{ width:18, height:18, borderRadius:'50%', background:color+'33', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:700, color }}>{getInitials(p.name)}</div>
                }
                {p.name}
                {sel && <span style={{ background:color, color:'white', borderRadius:10, padding:'1px 6px', fontSize:10 }}>{activePlayers.findIndex(ap=>ap.id===p.id)+1}</span>}
              </button>
            )
          })}
        </div>
        {selectedPlayers.length<2 && <p style={{ fontSize:12, color:'var(--text-muted)', marginTop:8 }}>Seleccioná al menos 2 jugadores para comparar</p>}
      </div>

      {selectedPlayers.length<2 ? (
        <div className="empty"><div className="empty-icon">⚔️</div><p>Seleccioná al menos 2 jugadores para ver la comparación.</p></div>
      ) : (
        <>
          {/* Summary table */}
          <div className="card" style={{ marginBottom:16 }}>
            <h3>📊 Resumen comparativo</h3>
            <table>
              <thead>
                <tr>
                  <th>Métrica</th>
                  {activePlayers.map((p,i)=>(
                    <th key={p.id} style={{ color:p.avatar_color||COLORS[i%COLORS.length] }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        {p.photo_url
                          ? <img src={p.photo_url} alt="" style={{ width:20,height:20,borderRadius:'50%',objectFit:'cover' }} />
                          : <div style={{ width:20,height:20,borderRadius:'50%',background:(p.avatar_color||COLORS[i%COLORS.length])+'33',display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:700,color:p.avatar_color||COLORS[i%COLORS.length] }}>{getInitials(p.name)}</div>
                        }
                        {p.name}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {summaryRows.map(row=>{
                  const values = activePlayers.map(p=>statsMap[p.id]?.[row.key]||0)
                  const best = row.higherBetter ? Math.max(...values) : Math.min(...values)
                  return (
                    <tr key={row.label}>
                      <td style={{ color:'var(--text-secondary)', fontWeight:500 }}>{row.label}</td>
                      {activePlayers.map((p,i)=>{
                        const val = statsMap[p.id]?.[row.key]||0
                        const isBest = val===best && values.filter(v=>v===best).length<values.length
                        return (
                          <td key={p.id} style={{ color: isBest?'var(--accent-green)':'var(--text-secondary)', fontWeight: isBest?700:400 }}>
                            {row.format(val)} {isBest&&'✓'}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
            {/* PPP bar */}
            <div className="card">
              <h3>🫘 Porotos/partida</h3>
              <div style={{ height:200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={pppData}>
                    <XAxis dataKey="name" tick={{ fill:'var(--text-muted)', fontSize:11 }} />
                    <YAxis tick={{ fill:'var(--text-muted)', fontSize:11 }} />
                    <Tooltip content={<TT />} />
                    <Bar dataKey="ppp" name="🫘/partida" radius={[4,4,0,0]}>
                      {pppData.map((d,i)=><Cell key={i} fill={d.ppp<=0?'#22d3a5':'#ff4655'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Radar */}
            {radarData.length>0 && activePlayers.length>=2 && (
              <div className="card">
                <h3>🕸️ Radar de performance</h3>
                <div style={{ height:200 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="var(--border)" />
                      <PolarAngleAxis dataKey="metric" tick={{ fill:'var(--text-muted)', fontSize:10 }} />
                      <PolarRadiusAxis angle={90} domain={[0,100]} tick={false} axisLine={false} />
                      {activePlayers.map((p,i)=>(
                        <Radar key={p.id} name={p.name} dataKey={p.name}
                          stroke={p.avatar_color||COLORS[i%COLORS.length]}
                          fill={p.avatar_color||COLORS[i%COLORS.length]}
                          fillOpacity={0.15} strokeWidth={2}
                        />
                      ))}
                      <Legend wrapperStyle={{ fontSize:12 }} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>

          {/* Category comparison */}
          {catCompData.length>0 && (
            <div className="card" style={{ marginBottom:16 }}>
              <h3>🏷️ Categorías por jugador</h3>
              <div style={{ height:240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={catCompData} layout="vertical" margin={{ left:0, right:20 }}>
                    <XAxis type="number" tick={{ fill:'var(--text-muted)', fontSize:11 }} />
                    <YAxis type="category" dataKey="cat" tick={{ fill:'var(--text-secondary)', fontSize:11 }} width={100} />
                    <Tooltip content={<TT />} />
                    <Legend wrapperStyle={{ fontSize:12 }} />
                    {activePlayers.map((p,i)=>(
                      <Bar key={p.id} dataKey={p.name} fill={p.avatar_color||COLORS[i%COLORS.length]} radius={[0,4,4,0]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Map comparison */}
          {mapCompData.length>0 && (
            <div className="card">
              <h3>🗺️ 🫘/partida por mapa</h3>
              <div style={{ height:220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={mapCompData}>
                    <XAxis dataKey="map" tick={{ fill:'var(--text-muted)', fontSize:10 }} />
                    <YAxis tick={{ fill:'var(--text-muted)', fontSize:11 }} />
                    <Tooltip content={<TT />} />
                    <Legend wrapperStyle={{ fontSize:12 }} />
                    {activePlayers.map((p,i)=>(
                      <Bar key={p.id} dataKey={p.name} fill={p.avatar_color||COLORS[i%COLORS.length]} radius={[4,4,0,0]} />
                    ))}
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
