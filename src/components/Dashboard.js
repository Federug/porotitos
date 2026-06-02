import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend
} from 'recharts'

const COLORS = ['#ff4655', '#22d3a5', '#5b8af5', '#f5a623', '#c084fc', '#fb923c']

function getInitials(name) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

export default function Dashboard() {
  const [players, setPlayers] = useState([])
  const [stats, setStats] = useState({ matches: 0, wins: 0, losses: 0, draws: 0 })
  const [categoryBreakdown, setCategoryBreakdown] = useState([])
  const [trendData, setTrendData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    await Promise.all([loadPlayerStats(), loadMatchStats(), loadCategoryBreakdown(), loadTrend()])
    setLoading(false)
  }

  async function loadPlayerStats() {
    const { data: playersData } = await supabase.from('players').select('*')
    if (!playersData) return

    const { data: events } = await supabase
      .from('match_events')
      .select('player_id, points')

    const totals = {}
    if (events) {
      events.forEach(e => {
        totals[e.player_id] = (totals[e.player_id] || 0) + e.points
      })
    }

    const enriched = playersData.map(p => ({
      ...p,
      totalPoints: totals[p.id] || 0
    })).sort((a, b) => b.totalPoints - a.totalPoints)

    setPlayers(enriched)
  }

  async function loadMatchStats() {
    const { data } = await supabase.from('matches').select('result')
    if (!data) return
    setStats({
      matches: data.length,
      wins: data.filter(m => m.result === 'victoria').length,
      losses: data.filter(m => m.result === 'derrota').length,
      draws: data.filter(m => m.result === 'empate').length,
    })
  }

  async function loadCategoryBreakdown() {
    const { data: cats } = await supabase.from('categories').select('id, name, points')
    const { data: events } = await supabase.from('match_events').select('category_id, points')
    if (!cats || !events) return

    const counts = {}
    events.forEach(e => {
      counts[e.category_id] = (counts[e.category_id] || 0) + 1
    })

    const breakdown = cats
      .map(c => ({ name: c.name, count: counts[c.id] || 0, points: c.points }))
      .filter(c => c.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)

    setCategoryBreakdown(breakdown)
  }

  async function loadTrend() {
    const { data: matches } = await supabase
      .from('matches')
      .select('id, played_at')
      .order('played_at', { ascending: true })
      .limit(10)

    if (!matches || matches.length === 0) return

    const { data: events } = await supabase
      .from('match_events')
      .select('match_id, player_id, points')

    const { data: playersData } = await supabase.from('players').select('id, name')
    if (!playersData) return

    const trend = matches.map(m => {
      const matchEvents = events ? events.filter(e => e.match_id === m.id) : []
      const entry = {
        date: new Date(m.played_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
      }
      playersData.forEach(p => {
        const pEvents = matchEvents.filter(e => e.player_id === p.id)
        entry[p.name] = pEvents.reduce((s, e) => s + e.points, 0)
      })
      return entry
    })

    setTrendData(trend)
  }

  if (loading) return <div className="loading">Cargando dashboard...</div>

  const winRate = stats.matches > 0 ? Math.round((stats.wins / stats.matches) * 100) : 0

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload) return null
    return (
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px' }}>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ fontSize: 13, color: p.color }}>
            {p.name}: {p.value > 0 ? '+' : ''}{p.value} 🫘
          </p>
        ))}
      </div>
    )
  }

  return (
    <div>
      <h2>🎯 Dashboard</h2>

      {/* Stats row */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">Partidas</div>
          <div className="stat-value blue">{stats.matches}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Victorias</div>
          <div className="stat-value green">{stats.wins}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Derrotas</div>
          <div className="stat-value red">{stats.losses}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Win Rate</div>
          <div className={`stat-value ${winRate >= 50 ? 'green' : 'red'}`}>{winRate}%</div>
        </div>
      </div>

      {players.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">🫘</div>
          <p>Sin datos aún. Empezá agregando jugadores y registrando partidas.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          {/* Ranking */}
          <div className="card">
            <h3>🏆 Ranking Porotitos</h3>
            {players.map((p, i) => (
              <div key={p.id} className={`player-row rank-${i + 1}`}>
                <span className="rank-num">#{i + 1}</span>
                <div
                  className="player-avatar"
                  style={{ background: p.avatar_color + '22', color: p.avatar_color, border: `1px solid ${p.avatar_color}44` }}
                >
                  {getInitials(p.name)}
                </div>
                <span className="player-name">{p.name}</span>
                <span className={`player-beans ${p.totalPoints > 0 ? 'beans-positive' : p.totalPoints < 0 ? 'beans-negative' : 'beans-neutral'}`}>
                  {p.totalPoints > 0 ? '+' : ''}{p.totalPoints} 🫘
                </span>
              </div>
            ))}
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10, textAlign: 'center' }}>
              Más porotos = peor rendimiento
            </p>
          </div>

          {/* Category chart */}
          <div className="card">
            <h3>📊 Categorías más frecuentes</h3>
            {categoryBreakdown.length === 0 ? (
              <div className="empty" style={{ padding: 24 }}>
                <p>Sin eventos registrados</p>
              </div>
            ) : (
              <div className="chart-container" style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryBreakdown} layout="vertical" margin={{ left: 0, right: 20 }}>
                    <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                    <YAxis
                      type="category" dataKey="name"
                      tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                      width={90}
                    />
                    <Tooltip
                      contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8 }}
                      labelStyle={{ color: 'var(--text-primary)' }}
                      itemStyle={{ color: 'var(--text-secondary)' }}
                    />
                    <Bar
                      dataKey="count"
                      fill="#5b8af5"
                      radius={[0, 4, 4, 0]}
                      name="Veces"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Trend per match */}
      {trendData.length > 1 && players.length > 0 && (
        <div className="card">
          <h3>📈 Porotos por partida (últimas 10)</h3>
          <div className="chart-container" style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 5, right: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: 12, color: 'var(--text-secondary)' }}
                />
                {players.map((p, i) => (
                  <Line
                    key={p.id}
                    type="monotone"
                    dataKey={p.name}
                    stroke={COLORS[i % COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}
