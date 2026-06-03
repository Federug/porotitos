import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

function getInitials(name) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function PlayerAvatar({ player, size = 48 }) {
  if (player.photo_url) {
    return <img src={player.photo_url} alt={player.name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${player.avatar_color}55` }} />
  }
  return (
    <div className="player-avatar" style={{
      width: size, height: size, fontSize: size * 0.33,
      background: player.avatar_color + '22', color: player.avatar_color,
      border: `2px solid ${player.avatar_color}55`
    }}>
      {getInitials(player.name)}
    </div>
  )
}

function EditPlayerModal({ player, onSave, onClose }) {
  const [name, setName] = useState(player.name)
  const [color, setColor] = useState(player.avatar_color || '#ff4655')
  const [photoUrl, setPhotoUrl] = useState(player.photo_url || '')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef()

  async function handleFileChange(e) {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) return setError('La imagen no puede superar 2MB')

    setUploading(true)
    setError('')

    // Convert to base64 data URL for simple storage
    const reader = new FileReader()
    reader.onload = async (ev) => {
      setPhotoUrl(ev.target.result)
      setUploading(false)
    }
    reader.onerror = () => { setError('Error al leer el archivo'); setUploading(false) }
    reader.readAsDataURL(file)
  }

  async function handleSave() {
    if (!name.trim()) return setError('El nombre no puede estar vacío')
    if (!/^#[0-9A-Fa-f]{6}$/.test(color)) return setError('Color inválido. Usá formato #RRGGBB')
    setSaving(true)
    const { error: err } = await supabase.from('players').update({
      name: name.trim(),
      avatar_color: color,
      photo_url: photoUrl || null
    }).eq('id', player.id)
    setSaving(false)
    if (err) return setError('Error: ' + err.message)
    onSave()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div className="card" style={{ width: 420, maxWidth: '95vw' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 16, color: 'var(--text-primary)' }}>Editar jugador</h3>
          <button className="btn btn-sm" onClick={onClose}>×</button>
        </div>

        {/* Avatar preview */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <div style={{ position: 'relative' }}>
            <PlayerAvatar player={{ ...player, name, avatar_color: color, photo_url: photoUrl }} size={80} />
            <button
              onClick={() => fileRef.current?.click()}
              style={{ position: 'absolute', bottom: 0, right: 0, width: 26, height: 26, borderRadius: '50%', background: 'var(--accent-blue)', border: 'none', cursor: 'pointer', fontSize: 12, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >📷</button>
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
        </div>

        {uploading && <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>Cargando imagen...</p>}

        <div className="form-group">
          <label>Nombre / IGN</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Nombre del jugador" />
        </div>

        <div className="form-group">
          <label>Color (formato HEX)</label>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <input
              value={color}
              onChange={e => setColor(e.target.value)}
              placeholder="#ff4655"
              style={{ flex: 1 }}
            />
            <input
              type="color"
              value={/^#[0-9A-Fa-f]{6}$/.test(color) ? color : '#ff4655'}
              onChange={e => setColor(e.target.value)}
              style={{ width: 40, height: 38, padding: 2, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer' }}
            />
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: /^#[0-9A-Fa-f]{6}$/.test(color) ? color : 'transparent', border: '2px solid var(--border)', flexShrink: 0 }} />
          </div>
        </div>

        <div className="form-group">
          <label>URL de foto (opcional)</label>
          <input value={photoUrl} onChange={e => setPhotoUrl(e.target.value)} placeholder="https://... o pegá una URL de imagen" />
        </div>

        {photoUrl && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <button className="btn btn-sm btn-danger" onClick={() => setPhotoUrl('')}>Quitar foto</button>
          </div>
        )}

        {error && <p style={{ color: 'var(--accent)', fontSize: 13, marginBottom: 12 }}>{error}</p>}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  )
}

export default function Players({ onUpdate }) {
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('#ff4655')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const [editingPlayer, setEditingPlayer] = useState(null)

  useEffect(() => { loadPlayers() }, [])

  async function loadPlayers() {
    const { data } = await supabase.from('players').select('*').order('name')
    setPlayers(data || [])
    setLoading(false)
  }

  async function addPlayer() {
    if (!newName.trim()) return setError('Ingresá un nombre')
    if (!/^#[0-9A-Fa-f]{6}$/.test(newColor)) return setError('Color inválido. Usá formato #RRGGBB')
    setAdding(true)
    const { error: err } = await supabase.from('players').insert({ name: newName.trim(), avatar_color: newColor })
    if (err) { setError('Error: ' + err.message) }
    else {
      setNewName('')
      setNewColor('#ff4655')
      setError('')
      await loadPlayers()
      onUpdate()
    }
    setAdding(false)
  }

  async function deletePlayer(id) {
    if (!window.confirm('¿Eliminar este jugador? Se perderán todos sus datos.')) return
    await supabase.from('players').delete().eq('id', id)
    await loadPlayers()
    onUpdate()
  }

  if (loading) return <div className="loading">Cargando jugadores...</div>

  return (
    <div>
      <h2>👥 Jugadores</h2>

      {editingPlayer && (
        <EditPlayerModal
          player={editingPlayer}
          onSave={async () => { setEditingPlayer(null); await loadPlayers(); onUpdate() }}
          onClose={() => setEditingPlayer(null)}
        />
      )}

      <div className="card" style={{ marginBottom: 24 }}>
        <h3>Agregar jugador</h3>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ flex: 1, minWidth: 160, marginBottom: 0 }}>
            <label>Nombre / IGN</label>
            <input placeholder="ej: Ricky" value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addPlayer()} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Color (HEX)</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input value={newColor} onChange={e => setNewColor(e.target.value)} placeholder="#ff4655" style={{ width: 110 }} />
              <input type="color" value={/^#[0-9A-Fa-f]{6}$/.test(newColor) ? newColor : '#ff4655'} onChange={e => setNewColor(e.target.value)}
                style={{ width: 38, height: 38, padding: 2, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer' }} />
            </div>
          </div>
          <button className="btn btn-primary" onClick={addPlayer} disabled={adding || !newName.trim()}>
            {adding ? 'Agregando...' : '+ Agregar'}
          </button>
        </div>
        {error && <p style={{ color: 'var(--accent)', fontSize: 13, marginTop: 8 }}>{error}</p>}
      </div>

      {players.length === 0 ? (
        <div className="empty"><div className="empty-icon">👤</div><p>No hay jugadores. Agregá a tu squad.</p></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
          {players.map(p => (
            <div key={p.id} className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center', padding: 20 }}>
              <PlayerAvatar player={p} size={64} />
              <div>
                <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-primary)' }}>{p.name}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', marginTop: 4 }}>
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: p.avatar_color }} />
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{p.avatar_color}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-sm" style={{ borderColor: 'var(--accent-blue)', color: 'var(--accent-blue)' }} onClick={() => setEditingPlayer(p)}>✎ Editar</button>
                <button className="btn btn-sm btn-danger" onClick={() => deletePlayer(p.id)}>Eliminar</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
