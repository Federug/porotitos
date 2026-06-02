import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Categories() {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [newPoints, setNewPoints] = useState(1)
  const [newDesc, setNewDesc] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const [usageCount, setUsageCount] = useState({})

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const { data: cats } = await supabase.from('categories').select('*').order('name')
    setCategories(cats || [])

    const { data: events } = await supabase.from('match_events').select('category_id')
    const counts = {}
    if (events) events.forEach(e => { counts[e.category_id] = (counts[e.category_id] || 0) + 1 })
    setUsageCount(counts)
    setLoading(false)
  }

  async function addCategory() {
    if (!newName.trim()) return setError('Ingresá un nombre')
    if (newPoints === 0) return setError('Los puntos no pueden ser 0')
    setAdding(true)
    const { error: err } = await supabase
      .from('categories')
      .insert({ name: newName.trim(), points: parseInt(newPoints), description: newDesc.trim() || null })
    if (err) {
      setError('Error: ' + err.message)
    } else {
      setNewName('')
      setNewPoints(1)
      setNewDesc('')
      setError('')
      await loadAll()
    }
    setAdding(false)
  }

  async function deleteCategory(id) {
    if (!window.confirm('¿Eliminar esta categoría?')) return
    await supabase.from('categories').delete().eq('id', id)
    await loadAll()
  }

  if (loading) return <div className="loading">Cargando categorías...</div>

  const positive = categories.filter(c => c.points > 0)
  const negative = categories.filter(c => c.points < 0)

  return (
    <div>
      <h2>🏷️ Categorías de Porotitos</h2>

      {/* Add form */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h3>Agregar categoría</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 3fr auto', gap: 12, alignItems: 'flex-end' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Nombre</label>
            <input
              placeholder="ej: Triple Kill"
              value={newName}
              onChange={e => setNewName(e.target.value)}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Puntos</label>
            <input
              type="number"
              value={newPoints}
              onChange={e => setNewPoints(e.target.value)}
              placeholder="ej: +1 o -1"
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Descripción (opcional)</label>
            <input
              placeholder="ej: Hizo tres kills seguidos"
              value={newDesc}
              onChange={e => setNewDesc(e.target.value)}
            />
          </div>
          <button className="btn btn-primary" onClick={addCategory} disabled={adding || !newName.trim()}>
            {adding ? '...' : '+ Agregar'}
          </button>
        </div>
        {error && <p style={{ color: 'var(--accent)', fontSize: 13, marginTop: 8 }}>{error}</p>}
        <div style={{ marginTop: 12, padding: 10, background: 'var(--bg-surface)', borderRadius: 6, fontSize: 12, color: 'var(--text-muted)' }}>
          💡 Puntos positivos (+1) = suma porotos (malo). Puntos negativos (-1) = resta porotos (bueno).
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Positive (bad) */}
        <div>
          <h3 style={{ color: 'var(--accent)' }}>➕ Suman porotos (malo)</h3>
          {positive.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Sin categorías positivas</p>
          ) : positive.map(c => (
            <div key={c.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 14px', background: 'var(--bg-card)',
              border: '1px solid var(--border)', borderRadius: 8,
              marginBottom: 6
            }}>
              <span className="points-pill pos">+{c.points}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500, fontSize: 14, color: 'var(--text-primary)' }}>{c.name}</div>
                {c.description && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.description}</div>}
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 50, textAlign: 'right' }}>
                {usageCount[c.id] || 0} veces
              </span>
              <button
                className="btn btn-sm btn-danger"
                onClick={() => deleteCategory(c.id)}
                disabled={usageCount[c.id] > 0}
                title={usageCount[c.id] > 0 ? 'No se puede eliminar: tiene eventos asignados' : 'Eliminar'}
              >×</button>
            </div>
          ))}
        </div>

        {/* Negative (good) */}
        <div>
          <h3 style={{ color: 'var(--accent-green)' }}>➖ Restan porotos (bueno)</h3>
          {negative.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Sin categorías negativas</p>
          ) : negative.map(c => (
            <div key={c.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 14px', background: 'var(--bg-card)',
              border: '1px solid var(--border)', borderRadius: 8,
              marginBottom: 6
            }}>
              <span className="points-pill neg">{c.points}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500, fontSize: 14, color: 'var(--text-primary)' }}>{c.name}</div>
                {c.description && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.description}</div>}
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 50, textAlign: 'right' }}>
                {usageCount[c.id] || 0} veces
              </span>
              <button
                className="btn btn-sm btn-danger"
                onClick={() => deleteCategory(c.id)}
                disabled={usageCount[c.id] > 0}
                title={usageCount[c.id] > 0 ? 'No se puede eliminar: tiene eventos asignados' : 'Eliminar'}
              >×</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
