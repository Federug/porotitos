import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

const TROPHY_DEFS = [
  { id: 'most_clutch', icon: '⚡', label: 'Más Clutches', desc: 'Más clutches realizados en el mes', color: '#f5a623', categoryName: 'Clutch', higherIsBetter: false },
  { id: 'best_ppp', icon: '🫘', label: 'El más limpio', desc: 'Mejor poroto/partida del mes', color: '#22d3a5', higherIsBetter: false, special: 'best_ppp' },
  { id: 'worst_ppp', icon: '🗑️', label: 'El más cargado', desc: 'Mayor porotos/partida del mes', color: '#ff4655', higherIsBetter: true, special: 'worst_ppp' },
  { id: 'most_ace', icon: '💀', label: 'Ace Machine', desc: 'Más Aces realizados en el mes', color: '#c084fc', categoryName: 'Ace', higherIsBetter: false },
  { id: 'most_mvp', icon: '👑', label: 'MVP del mes', desc: 'Más MVPs relativos a partidas jugadas', color: '#5b8af5', categoryName: 'MVP', higherIsBetter: false, relative: true },
  { id: 'most_last', icon: '🪦', label: 'El del fondo', desc: 'Más veces último relativo a partidas jugadas', color: '#ff4655', categoryName: 'Último', higherIsBetter: true, relative: true },
  { id: 'best_single_match', icon: '✨', label: 'Partida épica', desc: 'Mayor porotos negativos en una misma partida', color: '#22d3a5', special: 'best_single_match' },
  { id: 'worst_single_match', icon: '💀', label: 'Desastre total', desc: 'Mayor porotos positivos en una misma partida', color: '#ff4655', special: 'worst_single_match' },
  { id: 'most_matches', icon: '🎮', label: 'El más activo', desc: 'Más partidas jugadas en el mes', color: '#fb923c', special: 'most_matches' },
]

function getInitials(name) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

export default function Trophies() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [players, setPlayers] = useState([])
  const [matches, setMatches] = useState([])
  const [events, setEvents] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [trophies, setTrophies] = useState([])

  useEffect(() => { loadAll() }, [])
  useEffect(() => { if (!loading) computeTrophies() }, [year, month, loading, players, matches, events, categories])

  async function loadAll() {
    const [{ data: p }, { data: m }, { data: e }, { data: c }] = await Promise.all([
      supabase.from('players').select('*'),
      supabase.from('matches').select('*'),
      supabase.from('match_events').select('*'),
      supabase.from('categories').select('*'),
    ])
    setPlayers(p || [])
    setMatches(m || [])
    setEvents(e || [])
    setCategories(c || [])
    setLoading(false)
  }

  function computeTrophies() {
    const filteredMatches = matches.filter(m => {
      const d = new Date(m.played_at)
      return d.getFullYear() === year && d.getMonth() === month
    })
    const filteredMatchIds = new Set(filteredMatches.map(m => m.id))
    const filteredEvents = events.filter(e => filteredMatchIds.has(e.match_id))

    if (filteredMatches.length === 0) { setTrophies([]); return }

    const results = []

    for (const def of TROPHY_DEFS) {
      let winner = null
      let winnerValue = null
      let allValues = []

      if (def.special === 'best_ppp') {
        allValues = players.map(p => {
          const pEvts = filteredEvents.filter(e => e.player_id === p.id)
          const matchesPlayed = new Set(pEvts.map(e => e.match_id)).size
          if (matchesPlayed === 0) return null
          const total = pEvts.reduce((s, e) => s + e.points, 0)
          return { player: p, value: total / matchesPlayed, display: (total / matchesPlayed).toFixed(2) }
        }).filter(Boolean)
        const best = allValues.sort((a, b) => a.value - b.value)[0]
        winner = best?.player
        winnerValue = best?.display

      } else if (def.special === 'worst_ppp') {
        allValues = players.map(p => {
          const pEvts = filteredEvents.filter(e => e.player_id === p.id)
          const matchesPlayed = new Set(pEvts.map(e => e.match_id)).size
          if (matchesPlayed === 0) return null
          const total = pEvts.reduce((s, e) => s + e.points, 0)
          return { player: p, value: total / matchesPlayed, display: '+' + (total / matchesPlayed).toFixed(2) }
        }).filter(Boolean)
        const worst = allValues.sort((a, b) => b.value - a.value)[0]
        winner = worst?.player
        winnerValue = worst?.display

      } else if (def.special === 'best_single_match') {
        let best = { pts: 0, player: null, matchMap: '' }
        filteredMatches.forEach(m => {
          players.forEach(p => {
            const pts = filteredEvents.filter(e => e.match_id === m.id && e.player_id === p.id).reduce((s, e) => s + e.points, 0)
            if (pts < best.pts) best = { pts, player: p, matchMap: m.map }
          })
        })
        winner = best.player
        winnerValue = best.pts !== 0 ? `${best.pts} 🫘 en ${best.matchMap}` : null

      } else if (def.special === 'worst_single_match') {
        let worst = { pts: 0, player: null, matchMap: '' }
        filteredMatches.forEach(m => {
          players.forEach(p => {
            const pts = filteredEvents.filter(e => e.match_id === m.id && e.player_id === p.id).reduce((s, e) => s + e.points, 0)
            if (pts > worst.pts) worst = { pts, player: p, matchMap: m.map }
          })
        })
        winner = worst.player
        winnerValue = worst.pts !== 0 ? `+${worst.pts} 🫘 en ${worst.matchMap}` : null

      } else if (def.special === 'most_matches') {
        allValues = players.map(p => {
          const pEvts = filteredEvents.filter(e => e.player_id === p.id)
          const matchesPlayed = new Set(pEvts.map(e => e.match_id)).size
          return { player: p, value: matchesPlayed }
        })
        const best = allValues.sort((a, b) => b.value - a.value)[0]
        winner = best?.value > 0 ? best.player : null
        winnerValue = best?.value > 0 ? `${best.value} partidas` : null

      } else if (def.categoryName) {
        const cat = categories.find(c => c.name === def.categoryName)
        if (!cat) continue

        allValues = players.map(p => {
          const count = filteredEvents.filter(e => e.player_id === p.id && e.category_id === cat.id).length
          const matchesPlayed = new Set(filteredEvents.filter(e => e.player_id === p.id).map(e => e.match_id)).size
          const ratio = matchesPlayed > 0 ? count / matchesPlayed : 0
          return { player: p, count, matchesPlayed, ratio }
        })

        if (def.relative) {
          const sorted = allValues.filter(v => v.count > 0).sort((a, b) =>
            def.higherIsBetter ? b.ratio - a.ratio : a.ratio - b.ratio
          )
          winner = sorted[0]?.player || null
          winnerValue = sorted[0] ? `${sorted[0].count} veces (${(sorted[0].ratio * 100).toFixed(0)}% partidas)` : null
        } else {
          const sorted = allValues.filter(v => v.count > 0).sort((a, b) => b.count - a.count)
          winner = sorted[0]?.player || null
          winnerValue = sorted[0] ? `${sorted[0].count} veces` : null
        }
      }

      results.push({ ...def, winner, winnerValue })
    }

    setTrophies(results)
  }

  const availableYears = [...new Set(matches.map(m => new Date(m.played_at).getFullYear()))].sort((a,b) => b-a)
  if (!availableYears.includes(now.getFullYear())) availableYears.unshift(now.getFullYear())

  if (loading) return <div className="loading">Cargando trofeos...</div>

  const hasAnyWinner = trophies.some(t => t.winner)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <h2 style={{ marginBottom: 0 }}>🏆 Trofeos Mensuales</h2>
        <span style={{ flex: 1 }} />
        <select value={year} onChange={e => setYear(parseInt(e.target.value))} style={{ width: 100 }}>
          {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={month} onChange={e => setMonth(parseInt(e.target.value))} style={{ width: 130 }}>
          {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
        </select>
      </div>

      {!hasAnyWinner ? (
        <div className="empty">
          <div className="empty-icon">🏆</div>
          <p>No hay partidas en {MONTHS[month]} {year} para calcular trofeos.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
          {trophies.map(t => (
            <div key={t.id} className="card" style={{
              border: `1px solid ${t.winner ? t.color + '44' : 'var(--border)'}`,
              background: t.winner ? t.color + '0a' : 'var(--bg-card)',
              opacity: t.winner ? 1 : 0.5
            }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 12,
                  background: t.color + '22',
                  border: `1px solid ${t.color}44`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 22, flexShrink: 0
                }}>
                  {t.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 15, color: t.color, marginBottom: 2 }}>
                    {t.label}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>{t.desc}</div>

                  {t.winner ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className="player-avatar" style={{
                        width: 28, height: 28, fontSize: 11,
                        background: t.winner.avatar_color + '22',
                        color: t.winner.avatar_color,
                        border: `1px solid ${t.winner.avatar_color}55`
                      }}>
                        {getInitials(t.winner.name)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{t.winner.name}</div>
                        {t.winnerValue && <div style={{ fontSize: 12, color: t.color }}>{t.winnerValue}</div>}
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Sin ganador este mes</div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
