import React, { useState, useEffect } from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Dashboard from './components/Dashboard'
import PersonalDashboard from './components/PersonalDashboard'
import ComparativeDashboard from './components/ComparativeDashboard'
import NewMatch from './components/NewMatch'
import MatchHistory from './components/MatchHistory'
import Players from './components/Players'
import Categories from './components/Categories'
import Trophies from './components/Trophies'
import AdminUsers from './components/AdminUsers'
import ImportExport from './components/ImportExport'
import Login from './components/Login'
import ChangePassword from './components/ChangePassword'
import Toast from './components/Toast'
import Setup from './components/Setup'
import { supabase } from './lib/supabase'
import './App.css'
 
export const VALORANT_MAPS = [
  'Abyss','Ascent','Bind','Breeze','Fracture',
  'Haven','Icebox','Lotus','Pearl','Split','Summit','Sunset'
]
 
function getInitials(n) { return n.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2) }
 
const VALID_PAGES = ['dashboard','personal','comparative','new-match','history','trophies','players','categories','import-export','admin-users']
 
function BuildTime() {
  // REACT_APP_BUILD_TIME is set by scripts/set-build-time.js during build
  const raw = process.env.REACT_APP_BUILD_TIME
  if (!raw) {
    // Fallback: show that no build time is available yet
    return (
      <div style={{ padding:'8px 12px', borderTop:'1px solid var(--border)', fontSize:10, color:'var(--text-muted)', textAlign:'center' }}>
        🔄 Sin fecha de deploy
      </div>
    )
  }
  try {
    const d = new Date(raw)
    const dateStr = d.toLocaleDateString('es-AR', { day:'2-digit', month:'2-digit', year:'numeric' })
    const timeStr = d.toLocaleTimeString('es-AR', { hour:'2-digit', minute:'2-digit' })
    return (
      <div style={{ padding:'8px 12px', borderTop:'1px solid var(--border)', fontSize:10, color:'var(--text-muted)', textAlign:'center', lineHeight:1.5 }}>
        🔄 Actualizado<br/>{dateStr} {timeStr}
      </div>
    )
  } catch { return null }
}
 
function AppInner() {
  const { user, player, isAdmin, loading } = useAuth()
  const [page, setPage] = useState(() => {
    const hash = window.location.hash.replace('#','')
    return VALID_PAGES.includes(hash) ? hash : 'dashboard'
  })
  const [refreshKey, setRefreshKey] = useState(0)
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [toast, setToast] = useState(null)
 
  // Always call hooks before any conditional returns
  useEffect(() => { window.location.hash = page }, [page])
 
  const isConfigured = !!(process.env.REACT_APP_SUPABASE_URL && process.env.REACT_APP_SUPABASE_ANON_KEY)
  if (!isConfigured) return <Setup />
 
  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg-base)' }}>
      <div style={{ textAlign:'center', color:'var(--text-muted)' }}>
        <div style={{ fontSize:40, marginBottom:12 }}>🫘</div>
        <p style={{ fontSize:14 }}>Cargando...</p>
      </div>
    </div>
  )
 
  if (!user) return <Login />
 
  const refresh = () => setRefreshKey(k=>k+1)
  const showToast = (message, type='success') => setToast({ message, type })
 
  const nav = [
    { id:'dashboard',     label:'Dashboard',          icon:'📊' },
    { id:'personal',      label:'Stats Personales',   icon:'👤' },
    { id:'comparative',   label:'Comparativo',        icon:'⚔️' },
    { id:'new-match',     label:'Nueva Partida',      icon:'🎮' },
    { id:'history',       label:'Historial',          icon:'📋' },
    { id:'trophies',      label:'Trofeos',            icon:'🏆' },
    { id:'players',       label:'Jugadores',          icon:'👥' },
    { id:'categories',    label:'Categorías',         icon:'🏷️' },
    { id:'import-export', label:'Importar / Exportar',icon:'📥' },
    ...(isAdmin ? [{ id:'admin-users', label:'Usuarios', icon:'🔐' }] : []),
  ]
 
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-header">
          <span className="logo-bean">🫘</span>
          <div>
            <h1 className="logo-title">POROTITOS</h1>
            <p className="logo-sub">Valorant Tracker</p>
          </div>
        </div>
 
        <nav className="sidebar-nav">
          {nav.map(item => (
            <button
              key={item.id}
              className={`nav-item ${page===item.id?'active':''}`}
              onClick={() => setPage(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
 
        <BuildTime />
 
        <div style={{ padding:'12px', borderTop:'1px solid var(--border)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
            {player?.photo_url
              ? <img src={player.photo_url} alt="" style={{ width:32, height:32, borderRadius:'50%', objectFit:'cover', border:`2px solid ${player.avatar_color}55`, flexShrink:0 }}/>
              : <div className="player-avatar" style={{ width:32, height:32, fontSize:12, background:(player?.avatar_color||'#ff4655')+'22', color:player?.avatar_color||'#ff4655', border:`2px solid ${player?.avatar_color||'#ff4655'}44`, flexShrink:0 }}>
                  {player ? getInitials(player.name) : '?'}
                </div>
            }
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {player?.name || 'Sin perfil'}
              </div>
              <div style={{ fontSize:10, color:isAdmin?'var(--accent)':'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px' }}>
                {isAdmin ? '⚡ Admin' : '👤 Jugador'}
              </div>
            </div>
          </div>
          <div style={{ display:'flex', gap:6 }}>
            <button className="btn btn-sm" style={{ flex:1, fontSize:11, padding:'5px 8px' }} onClick={()=>setShowChangePassword(true)}>
              🔑 Contraseña
            </button>
            <button className="btn btn-sm btn-danger" style={{ fontSize:11, padding:'5px 8px' }} onClick={()=>supabase.auth.signOut()}>
              Salir
            </button>
          </div>
        </div>
      </aside>
 
      <main className="main-content">
        {page==='dashboard'     && <Dashboard        key={refreshKey} />}
        {page==='personal'      && <PersonalDashboard key={refreshKey} />}
        {page==='comparative'   && <ComparativeDashboard key={refreshKey} />}
        {page==='new-match'     && <NewMatch onSaved={()=>{ refresh(); setPage('history'); showToast('✓ Partida guardada correctamente') }} />}
        {page==='history'       && <MatchHistory     key={refreshKey} isAdmin={isAdmin} />}
        {page==='trophies'      && <Trophies         key={refreshKey} />}
        {page==='players'       && <Players          key={refreshKey} onUpdate={refresh} isAdmin={isAdmin} />}
        {page==='categories'    && <Categories       key={refreshKey} />}
        {page==='import-export' && <ImportExport     key={refreshKey} />}
        {page==='admin-users'   && isAdmin && <AdminUsers key={refreshKey} />}
      </main>
 
      {showChangePassword && <ChangePassword onClose={()=>setShowChangePassword(false)} />}
      {toast && <Toast message={toast.message} type={toast.type} onClose={()=>setToast(null)} />}
    </div>
  )
}
 
export default function App() {
  return <AuthProvider><AppInner /></AuthProvider>
}
 
