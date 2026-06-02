import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { VALORANT_MAPS } from '../App'

export default function NewMatch({ onSaved, editMatch = null }) {
  const isEditing = !!editMatch

  const [map, setMap] = useState(editMatch?.map || '')
  const [result, setResult] = useState(editMatch?.result || 'victoria')
  const [scoreUs, setScoreUs] = useState(editMatch?.score_us ?? '')
  const [scoreThem, setScoreThem] = useState(editMatch?.score_them ?? '')
  const [notes, setNotes] = useState(editMatch?.notes || '')
  const [playedAt, setPlayedAt] = useState(
    editMatch?.played_at
      ? new Date(editMatch.played_at).toISOString().slice(0, 16)
      : new Date().toISOString().slice(0, 16)
  )
  const [players, setPlayers] = useState([])
  const [categories, setCategories] = useState([])
  const [events, setEvents] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const [{ data: p }, { data: c }] = await Promise.all([
      supabase.from('players').select('*').order('name'),
      supabase.from('categories').select('*').order('name')
    ])
    setPlayers(p || [])
    setCategories(c || [])

    if (isEditing && editMatch.id) {
      const { data: existingEvents } = await supabase
        .from('match_events')
        .select('*')
        .eq('match_id', editMatch.id)
      if (existingEvents) {
        setEvents(existingEvents.map(e => ({ playerId: e.player_id, categoryId: e.category_id })))
      }
    }
  }

  function addEvent() {
    setEvents([...events, { playerId: players[0]?.id || '', categoryId: categories[0]?.id || '' }])
  }

  function updateEvent(i, field, val) {
    const updated = [...events]
    updated[i] = { ...updated[i], [field]: val }
    setEvents(updated)
  }

  function removeEvent(i) {
    setEvents(events.filter((_, idx) => idx !== i))
  }

  async function handleSave() {
    if (!map) return setError('Seleccioná un mapa')
    setSaving(true)
    setError('')

    const matchData = {
      map,
      result,
      notes: notes || null,
      score_us: scoreUs !== '' ? parseInt(scoreUs) : null,
      score_them: scoreThem !== '' ? parseInt(scoreThem) : null,
      played_at: new Date(playedAt).toISOString(),
    }

    let matchId

    if (isEditing) {
      const { error: matchError } = await supabase
        .from('matches')
        .update({ ...matchData, edited_at: new Date().toISOString() })
        .eq('id', editMatch.id)

      if (matchError) {
        setSaving(false)
        return setError('Error al actualizar: ' + matchError.message)
      }
      matchId = editMatch.id
      await supabase.from('match_events').delete().eq('match_id', matchId)
    } else {
      const { data: match, error: matchError } = await supabase
        .from('matches')
        .insert(matchData)
        .select()
        .single()

      if (matchError) {
        setSaving(false)
        return setError('Error al guardar la partida: ' + matchError.message)
      }
      matchId = match.id
    }

    const validEvents = events.filter(e => e.playerId && e.categoryId)
    if (validEvents.length > 0) {
      const eventsToInsert = validEvents.map(e => {
        const cat = categories.find(c => c.id === e.categoryId)
        return {
          match_id: matchId,
          player_id: e.playerId,
          category_id: e.categoryId,
          points: cat?.points || 0
        }
      })
      const { error: eventsError } = await supabase.from('match_events').insert(eventsToInsert)
      if (eventsError) {
        setSaving(false)
        return setError('Error al guardar eventos: ' + eventsError.message)
      }
    }

    setSaving(false)
    onSaved()
  }

  const getCat = id => categories.find(c => c.id === id)

  const preview = {}
  events.forEach(e => {
    if (!e.playerId || !e.categoryId) return
    const cat = getCat(e.categoryId)
    if (!cat) return
    preview[e.playerId] = (preview[e.playerId] || 0) + cat.points
  })

  return (
    <div>
      <h2>{isEditing ? '✏️ Editar Partida' : '🎮 Registrar Partida'}</h2>

      {players.length === 0 && (
        <div style={{ padding: 16, background: 'var(--accent-dim)', borderRadius: 8, border: '1px solid rgba(255,70,85,0.3)', marginBottom: 16, fontSize: 13, color: 'var(--accent)' }}>
          ⚠️ Primero agregá los jugadores en la sección "Jugadores"
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div className="card">
          <h3>Información de la partida</h3>

          <div className="form-group">
            <label>Fecha y hora</label>
            <input
              type="datetime-local"
              value={playedAt}
              onChange={e => setPlayedAt(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Mapa</label>
            <select value={map} onChange={e => setMap(e.target.value)}>
              <option value="">Seleccionar mapa...</option>
              {VALORANT_MAPS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label>Resultado</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {['victoria', 'derrota', 'empate'].map(r => (
                <button
                  key={r}
                  onClick={() => setResult(r)}
                  className="btn"
                  style={{
                    flex: 1,
                    background: result === r
                      ? r === 'victoria' ? 'var(--accent-green)' : r === 'derrota' ? 'var(--accent)' : 'var(--accent-blue)'
                      : 'transparent',
                    borderColor: r === 'victoria' ? 'var(--accent-green)' : r === 'derrota' ? 'var(--accent)' : 'var(--accent-blue)',
                    color: result === r ? (r === 'victoria' ? '#0d0f14' : 'white') : 'var(--text-secondary)',
                    textTransform: 'capitalize',
                    fontWeight: result === r ? 600 : 400
                  }}
                >
                  {r === 'victoria' ? '✓ Victoria' : r === 'derrota' ? '✗ Derrota' : '= Empate'}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label>Nuestros rounds</label>
              <input
                type="number" min="0" max="25" placeholder="13"
                value={scoreUs} onChange={e => setScoreUs(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Rounds rivales</label>
              <input
                type="number" min="0" max="25" placeholder="7"
                value={scoreThem} onChange={e => setScoreThem(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Notas (opcional)</label>
            <textarea
              placeholder="Comentarios sobre la partida..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              style={{ resize: 'vertical' }}
            />
          </div>
        </div>

        <div>
          <div className="card" style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h3 style={{ marginBottom: 0 }}>Asignar porotitos</h3>
              <button className="btn btn-sm" onClick={addEvent} disabled={players.length === 0 || categories.length === 0}>
                + Agregar
              </button>
            </div>

            {events.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>
                Agregá eventos para asignar porotos
              </p>
            ) : events.map((ev, i) => {
              const cat = getCat(ev.categoryId)
              return (
                <div key={i} className="event-builder">
                  <div className="event-row">
                    <select
                      value={ev.playerId}
                      onChange={e => updateEvent(i, 'playerId', e.target.value)}
                      style={{ flex: 1 }}
                    >
                      {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <select
                      value={ev.categoryId}
                      onChange={e => updateEvent(i, 'categoryId', e.target.value)}
                      style={{ flex: 2 }}
                    >
                      {categories.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.points > 0 ? `+${c.points}` : c.points} 🫘 {c.name}
                        </option>
                      ))}
                    </select>
                    {cat && (
                      <span className={`points-pill ${cat.points > 0 ? 'pos' : 'neg'}`}>
                        {cat.points > 0 ? '+' : ''}{cat.points}
                      </span>
                    )}
                    <button className="btn btn-sm btn-danger" onClick={() => removeEvent(i)}>×</button>
                  </div>
                </div>
              )
            })}
          </div>

          {Object.keys(preview).length > 0 && (
            <div className="card">
              <h3>Preview de porotos</h3>
              {Object.entries(preview).map(([pid, pts]) => {
                const player = players.find(p => p.id === pid)
                if (!player) return null
                return (
                  <div key={pid} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{player.name}</span>
                    <span style={{ fontWeight: 600, color: pts > 0 ? 'var(--accent)' : pts < 0 ? 'var(--accent-green)' : 'var(--text-muted)', fontFamily: 'Rajdhani, sans-serif', fontSize: 16 }}>
                      {pts > 0 ? '+' : ''}{pts} 🫘
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {error && (
        <div style={{ marginTop: 16, padding: 12, background: 'var(--accent-dim)', border: '1px solid rgba(255,70,85,0.3)', borderRadius: 8, color: 'var(--accent)', fontSize: 13 }}>
          {error}
        </div>
      )}

      <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving || !map}>
          {saving ? 'Guardando...' : isEditing ? '✓ Guardar Cambios' : '✓ Guardar Partida'}
        </button>
        {isEditing && (
          <button className="btn" onClick={onSaved}>Cancelar</button>
        )}
      </div>
    </div>
  )
}
