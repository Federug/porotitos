import React, { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import Dashboard from './components/Dashboard'
import PersonalDashboard from './components/PersonalDashboard'
import ComparativeDashboard from './components/ComparativeDashboard'
import NewMatch from './components/NewMatch'
import MatchHistory from './components/MatchHistory'
import Players from './components/Players'
import Categories from './components/Categories'
import Trophies from './components/Trophies'
import Setup from './components/Setup'
import './App.css'

const VALORANT_MAPS = [
  'Abyss', 'Ascent', 'Bind', 'Breeze', 'Fracture',
  'Haven', 'Icebox', 'Lotus', 'Pearl', 'Split', 'Sunset'
]

export { VALORANT_MAPS }

export default function App() {
  const [page, setPage] = useState('dashboard')
  const [isConfigured, setIsConfigured] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    const url = process.env.REACT_APP_SUPABASE_URL
    const key = process.env.REACT_APP_SUPABASE_ANON_KEY
    setIsConfigured(!!(url && key && url !== '' && key !== ''))
  }, [])

  const refresh = () => setRefreshKey(k => k + 1)

  if (!isConfigured) return <Setup />

  const nav = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'personal', label: 'Stats Personales', icon: '👤' },
    { id: 'comparative', label: 'Comparativo', icon: '⚔️' },
    { id: 'new-match', label: 'Nueva Partida', icon: '🎮' },
    { id: 'history', label: 'Historial', icon: '📋' },
    { id: 'trophies', label: 'Trofeos', icon: '🏆' },
    { id: 'players', label: 'Jugadores', icon: '👥' },
    { id: 'categories', label: 'Categorías', icon: '🏷️' },
  ]

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-header">
          <span className="logo-bean">🫘</span>
          <div>
            <h1 className="logo-title">POROTITOS</h1>
            <p className="logo-sub">Sistema de scoring</p>
          </div>
        </div>
        <nav className="sidebar-nav">
          {nav.map(item => (
            <button
              key={item.id}
              className={`nav-item ${page === item.id ? 'active' : ''}`}
              onClick={() => setPage(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer"><p>Valorant Team Tracker</p></div>
      </aside>

      <main className="main-content">
        {page === 'dashboard' && <Dashboard key={refreshKey} />}
        {page === 'personal' && <PersonalDashboard key={refreshKey} />}
        {page === 'comparative' && <ComparativeDashboard key={refreshKey} />}
        {page === 'new-match' && <NewMatch onSaved={() => { refresh(); setPage('dashboard') }} />}
        {page === 'history' && <MatchHistory key={refreshKey} />}
        {page === 'trophies' && <Trophies key={refreshKey} />}
        {page === 'players' && <Players key={refreshKey} onUpdate={refresh} />}
        {page === 'categories' && <Categories key={refreshKey} />}
      </main>
    </div>
  )
}
