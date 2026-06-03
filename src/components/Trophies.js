import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

const MEDALS = [
  { label:'🥇', color:'#f5a623', shadow:'rgba(245,166,35,0.4)', rank:'1° Puesto' },
  { label:'🥈', color:'#adb5c8', shadow:'rgba(173,181,200,0.4)', rank:'2° Puesto' },
  { label:'🥉', color:'#cd7f32', shadow:'rgba(205,127,50,0.4)', rank:'3° Puesto' },
]

const TROPHY_DEFS = [
  { id:'most_clutch',     icon:'⚡', label:'Clutch Master',    desc:'Más clutches realizados',              color:'#f5a623', categoryName:'Clutch',    higherIsBetter:false },
  { id:'best_ppp',        icon:'🫘', label:'El más limpio',    desc:'Mejor poroto/partida del mes',          color:'#22d3a5', special:'best_ppp' },
  { id:'worst_ppp',       icon:'🗑️', label:'El más cargado',   desc:'Mayor poroto/partida del mes',          color:'#ff4655', special:'worst_ppp' },
  { id:'most_ace',        icon:'💀', label:'Ace Machine',      desc:'Más Aces realizados',                   color:'#c084fc', categoryName:'Ace',       higherIsBetter:false },
  { id:'most_mvp',        icon:'👑', label:'MVP del mes',      desc:'Más MVPs (relativo a partidas)',         color:'#5b8af5', categoryName:'MVP',       higherIsBetter:false, relative:true },
  { id:'most_last',       icon:'🪦', label:'El del fondo',     desc:'Más veces último (relativo a partidas)',color:'#ff4655', categoryName:'Último',    higherIsBetter:true,  relative:true },
  { id:'best_match',      icon:'✨', label:'Partida épica',    desc:'Mayor porotos negativos en una partida',color:'#22d3a5', special:'best_single_match' },
  { id:'worst_match',     icon:'💥', label:'Desastre total',   desc:'Mayor porotos positivos en una partida',color:'#ff4655', special:'worst_single_match' },
  { id:'most_matches',    icon:'🎮', label:'El más activo',    desc:'Más partidas jugadas en el mes',        color:'#fb923c', special:'most_matches' },
]

function getInitials(name) { return name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2) }

function PlayerChip({ player, value, medal }) {
  if (!player) return <div style={{ fontSize:12, color:'var(--text-muted)', padding:'8px 0' }}>Sin datos</div>
  const m = MEDALS[medal]
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', borderRadius:8, background: medal===0?m.color+'18':'var(--bg-surface)', border:`1px solid ${medal===0?m.color+'44':'var(--border)'}` }}>
      <span style={{ fontSize:18, lineHeight:1 }}>{m.label}</span>
      {player.photo_url
        ? <img src={player.photo_url} alt="" style={{ width:26, height:26, borderRadius:'50%', objectFit:'cover', border:`2px solid ${player.avatar_color}55` }} />
        : <div className="player-avatar" style={{ width:26, height:26, fontSize:10, background:player.avatar_color+'22', color:player.avatar_color, border:`1px solid ${player.avatar_color}44` }}>{getInitials(player.name)}</div>
      }
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontWeight:600, fontSize:13, color: medal===0?m.color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{player.name}</div>
        {value && <div style={{ fontSize:11, color:'var(--text-muted)' }}>{value}</div>}
      </div>
    </div>
  )
}

function TrophyCard({ trophy }) {
  return (
    <div className="card" style={{
      border:`1px solid ${trophy.podium[0]?trophy.color+'44':'var(--border)'}`,
      background: trophy.podium[0] ? trophy.color+'08' : 'var(--bg-card)',
      display:'flex', flexDirection:'column', gap:12
    }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        <div style={{
          width:48, height:48, borderRadius:12, flexShrink:0,
          background:trophy.color+'22', border:`1px solid ${trophy.color}44`,
          display:'flex', alignItems:'center', justifyContent:'center', fontSize:22
        }}>
          {trophy.icon}
        </div>
        <div>
          <div style={{ fontFamily:'Rajdhani,sans-serif', fontWeight:700, fontSize:16, color:trophy.color }}>{trophy.label}</div>
          <div style={{ fontSize:11, color:'var(--text-muted)' }}>{trophy.desc}</div>
        </div>
      </div>

      {/* Podium */}
      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
        {[0,1,2].map(i => (
          <PlayerChip key={i} player={trophy.podium[i]?.player} value={trophy.podium[i]?.display} medal={i} />
        ))}
      </div>
    </div>
  )
}

export default function Trophies() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [players, setPlayers] = useState([])
  const [matches, setMatches] = useState([])
  const [events, setEvents] = useState([])
  const [matchPlayers, setMatchPlayers] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [trophies, setTrophies] = useState([])

  useEffect(() => { loadAll() }, [])
  useEffect(() => { if (!loading) computeTrophies() }, [year, month, loading, players, matches, events, matchPlayers, categories])

  async function loadAll() {
    const [{ data:p },{ data:m },{ data:e },{ data:c },{ data:mp }] = await Promise.all([
      supabase.from('players').select('*'),
      supabase.from('matches').select('*'),
      supabase.from('match_events').select('*'),
      supabase.from('categories').select('*'),
      supabase.from('match_players').select('*'),
    ])
    setPlayers(p||[]); setMatches(m||[]); setEvents(e||[])
    setCategories(c||[]); setMatchPlayers(mp||[])
    setLoading(false)
  }

  function computeTrophies() {
    const filteredMatches = matches.filter(m => {
      const dateStr = String(m.played_at).slice(0, 10); const [py, pmo] = dateStr.split("-").map(Number)
      return py === year && (pmo - 1) === month
    })
    const filteredMatchIds = new Set(filteredMatches.map(m=>m.id))
    const filteredEvents = events.filter(e=>filteredMatchIds.has(e.match_id))
    const filteredMatchPlayers = matchPlayers.filter(mp=>filteredMatchIds.has(mp.match_id))

    function getMatchCount(pid) {
      return new Set(filteredMatchPlayers.filter(mp=>mp.player_id===pid).map(mp=>mp.match_id)).size
    }

    function getPPP(pid) {
      const pEvts = filteredEvents.filter(e=>e.player_id===pid)
      const mc = getMatchCount(pid)
      return mc>0 ? pEvts.reduce((s,e)=>s+e.points,0)/mc : null
    }

    // Build ranked list for a trophy definition
    function buildPodium(def) {
      let ranked = []

      if (def.special === 'best_ppp') {
        ranked = players.map(p => {
          const v = getPPP(p.id)
          return v!==null ? { player:p, value:v, display:v.toFixed(2)+' 🫘/p' } : null
        }).filter(Boolean).sort((a,b)=>a.value-b.value)

      } else if (def.special === 'worst_ppp') {
        ranked = players.map(p => {
          const v = getPPP(p.id)
          return v!==null ? { player:p, value:v, display:'+'+(v>0?v.toFixed(2):'0')+' 🫘/p' } : null
        }).filter(Boolean).sort((a,b)=>b.value-a.value)

      } else if (def.special === 'best_single_match') {
        const perPlayerMatch = []
        filteredMatches.forEach(m => {
          players.forEach(p => {
            const pts = filteredEvents.filter(e=>e.match_id===m.id&&e.player_id===p.id).reduce((s,e)=>s+e.points,0)
            if (pts!==0) perPlayerMatch.push({ player:p, value:pts, display:`${pts} 🫘 en ${m.map}` })
          })
        })
        // Best per player (most negative)
        const bestPerPlayer = {}
        perPlayerMatch.forEach(r => {
          if (!bestPerPlayer[r.player.id] || r.value < bestPerPlayer[r.player.id].value)
            bestPerPlayer[r.player.id] = r
        })
        ranked = Object.values(bestPerPlayer).sort((a,b)=>a.value-b.value).filter(r=>r.value<0)

      } else if (def.special === 'worst_single_match') {
        const perPlayerMatch = []
        filteredMatches.forEach(m => {
          players.forEach(p => {
            const pts = filteredEvents.filter(e=>e.match_id===m.id&&e.player_id===p.id).reduce((s,e)=>s+e.points,0)
            if (pts>0) perPlayerMatch.push({ player:p, value:pts, display:`+${pts} 🫘 en ${m.map}` })
          })
        })
        const worstPerPlayer = {}
        perPlayerMatch.forEach(r => {
          if (!worstPerPlayer[r.player.id] || r.value > worstPerPlayer[r.player.id].value)
            worstPerPlayer[r.player.id] = r
        })
        ranked = Object.values(worstPerPlayer).sort((a,b)=>b.value-a.value)

      } else if (def.special === 'most_matches') {
        ranked = players.map(p => {
          const mc = getMatchCount(p.id)
          return mc>0 ? { player:p, value:mc, display:`${mc} partidas` } : null
        }).filter(Boolean).sort((a,b)=>b.value-a.value)

      } else if (def.categoryName) {
        const cat = categories.find(c=>c.name===def.categoryName)
        if (!cat) return []
        ranked = players.map(p => {
          const count = filteredEvents.filter(e=>e.player_id===p.id&&e.category_id===cat.id).length
          if (count===0) return null
          const mc = getMatchCount(p.id)
          const ratio = mc>0 ? count/mc : 0
          if (def.relative) {
            return { player:p, value:ratio, count, display:`${count}x (${(ratio*100).toFixed(0)}% partidas)` }
          }
          return { player:p, value:count, display:`${count} veces` }
        }).filter(Boolean).sort((a,b) => def.higherIsBetter ? b.value-a.value : a.value-b.value)
      }

      return ranked.slice(0,3)
    }

    const results = TROPHY_DEFS.map(def => ({
      ...def,
      podium: buildPodium(def)
    }))

    setTrophies(results)
  }

  const availableYears = [...new Set(matches.map(m=>parseInt(String(m.played_at).slice(0,4))))].sort((a,b)=>b-a)
  if (!availableYears.includes(now.getFullYear())) availableYears.unshift(now.getFullYear())

  if (loading) return <div className="loading">Cargando trofeos...</div>

  const hasData = trophies.some(t=>t.podium.length>0)

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:24 }}>
        <h2 style={{ marginBottom:0 }}>🏆 Trofeos Mensuales</h2>
        <span style={{ flex:1 }} />
        <select value={year} onChange={e=>setYear(parseInt(e.target.value))} style={{ width:100 }}>
          {availableYears.map(y=><option key={y} value={y}>{y}</option>)}
        </select>
        <select value={month} onChange={e=>setMonth(parseInt(e.target.value))} style={{ width:140 }}>
          {MONTHS.map((m,i)=><option key={i} value={i}>{m}</option>)}
        </select>
      </div>

      <div style={{ marginBottom:16, padding:'10px 16px', background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:8, fontSize:13, color:'var(--text-secondary)' }}>
        Trofeos de <strong style={{ color:'var(--text-primary)' }}>{MONTHS[month]} {year}</strong> — Podio con 🥇 oro, 🥈 plata y 🥉 bronce por categoría
      </div>

      {!hasData ? (
        <div className="empty"><div className="empty-icon">🏆</div><p>No hay partidas en {MONTHS[month]} {year}.</p></div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:16 }}>
          {trophies.map(t => <TrophyCard key={t.id} trophy={t} />)}
        </div>
      )}
    </div>
  )
}
