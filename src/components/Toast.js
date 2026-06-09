import React, { useEffect } from 'react'

export default function Toast({ message, type = 'success', onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000)
    return () => clearTimeout(t)
  }, [onClose])

  const colors = {
    success: { bg: 'rgba(34,211,165,0.12)', border: 'rgba(34,211,165,0.3)', color: '#22d3a5', icon: '✓' },
    error:   { bg: 'rgba(255,70,85,0.12)',  border: 'rgba(255,70,85,0.3)',  color: '#ff4655', icon: '✕' },
    info:    { bg: 'rgba(91,138,245,0.12)', border: 'rgba(91,138,245,0.3)', color: '#5b8af5', icon: 'ℹ' },
  }
  const c = colors[type] || colors.success

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '12px 18px', borderRadius: 10,
      background: 'var(--bg-card)', border: `1px solid ${c.border}`,
      boxShadow: `0 4px 20px rgba(0,0,0,0.4)`,
      animation: 'slideIn 0.2s ease',
      maxWidth: 320,
    }}>
      <span style={{ fontSize: 16, color: c.color, fontWeight: 700 }}>{c.icon}</span>
      <span style={{ fontSize: 13, color: 'var(--text-primary)', flex: 1 }}>{message}</span>
      <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14, padding: 0 }}>×</button>
      <style>{`@keyframes slideIn { from { transform: translateX(20px); opacity:0 } to { transform: translateX(0); opacity:1 } }`}</style>
    </div>
  )
}
