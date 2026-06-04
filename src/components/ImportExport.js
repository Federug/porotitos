import React, { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import * as XLSX from 'xlsx'

const VALORANT_MAPS = ['Abyss','Ascent','Bind','Breeze','Fracture','Haven','Icebox','Lotus','Pearl','Split','Sunset']
const VALID_RESULTS = ['victoria','derrota','empate']

// ─── BACKUP ────────────────────────────────────────────────────────────────────
export async function downloadBackup() {
  const [{ data: matches }, { data: events }, { data: players }, { data: cats }, { data: matchPlayers }] = await Promise.all([
    supabase.from('matches').select('*').order('played_at'),
    supabase.from('match_events').select('*, players(name), categories(name, points)'),
    supabase.from('players').select('*').order('name'),
    supabase.from('categories').select('*').order('name'),
    supabase.from('match_players').select('*, players(name)'),
  ])

  const wb = XLSX.utils.book_new()

  // Sheet 1: PARTIDAS completas
  const matchRows = []
  ;(matches || []).forEach(m => {
    const mEvents = (events || []).filter(e => e.match_id === m.id)
    const mPlayers = (matchPlayers || []).filter(mp => mp.match_id === m.id)

    if (mEvents.length === 0) {
      matchRows.push({
        FECHA: String(m.played_at).slice(0,10),
        MAPA: m.map,
        RESULTADO: m.result,
        ROUNDS_NUESTROS: m.score_us ?? '',
        ROUNDS_RIVALES: m.score_them ?? '',
        JUGADORES: mPlayers.map(mp => mp.players?.name).filter(Boolean).join(', '),
        JUGADOR_EVENTO: '',
        CATEGORIA: '',
        PUNTOS: '',
        NOTAS: m.notes ?? '',
        EDITADO: m.edited_at ? String(m.edited_at).slice(0,10) : '',
        MATCH_ID: m.id,
      })
    } else {
      mEvents.forEach((ev, i) => {
        matchRows.push({
          FECHA: String(m.played_at).slice(0,10),
          MAPA: m.map,
          RESULTADO: m.result,
          ROUNDS_NUESTROS: m.score_us ?? '',
          ROUNDS_RIVALES: m.score_them ?? '',
          JUGADORES: i === 0 ? mPlayers.map(mp => mp.players?.name).filter(Boolean).join(', ') : '',
          JUGADOR_EVENTO: ev.players?.name ?? '',
          CATEGORIA: ev.categories?.name ?? '',
          PUNTOS: ev.points,
          NOTAS: i === 0 ? (m.notes ?? '') : '',
          EDITADO: m.edited_at ? String(m.edited_at).slice(0,10) : '',
          MATCH_ID: m.id,
        })
      })
    }
  })
  const ws1 = XLSX.utils.json_to_sheet(matchRows)
  ws1['!cols'] = [16,12,14,10,10,30,14,20,8,28,12,38].map(w => ({ wch: w }))
  XLSX.utils.book_append_sheet(wb, ws1, 'PARTIDAS')

  // Sheet 2: RANKING
  const playerStats = (players || []).map(p => {
    const pEvents = (events || []).filter(e => e.player_id === p.id)
    const total = pEvents.reduce((s, e) => s + e.points, 0)
    const matchCount = new Set((matchPlayers || []).filter(mp => mp.player_id === p.id).map(mp => mp.match_id)).size
    return {
      JUGADOR: p.name,
      POROTOS_TOTALES: total,
      PARTIDAS_JUGADAS: matchCount,
      POROTOS_POR_PARTIDA: matchCount > 0 ? parseFloat((total / matchCount).toFixed(2)) : 0,
      ROL: p.role,
    }
  }).sort((a, b) => a.POROTOS_POR_PARTIDA - b.POROTOS_POR_PARTIDA)
  const ws2 = XLSX.utils.json_to_sheet(playerStats)
  ws2['!cols'] = [18,16,16,20,12].map(w => ({ wch: w }))
  XLSX.utils.book_append_sheet(wb, ws2, 'RANKING')

  // Sheet 3: CATEGORIAS
  const catRows = (cats || []).map(c => ({
    NOMBRE: c.name,
    PUNTOS: c.points,
    DESCRIPCION: c.description ?? '',
  }))
  const ws3 = XLSX.utils.json_to_sheet(catRows)
  XLSX.utils.book_append_sheet(wb, ws3, 'CATEGORIAS')

  // Download
  const date = new Date().toISOString().slice(0,10)
  XLSX.writeFile(wb, `porotitos_backup_${date}.xlsx`)
}

// ─── IMPORT ────────────────────────────────────────────────────────────────────
export default function ImportExport() {
  const [tab, setTab] = useState('import')
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState([])
  const [errors, setErrors] = useState([])
  const [players, setPlayers] = useState([])
  const [categories, setCategories] = useState([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState(null)
  const [backingUp, setBackingUp] = useState(false)
  const fileRef = useRef()

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const [{ data: p }, { data: c }] = await Promise.all([
      supabase.from('players').select('*'),
      supabase.from('categories').select('*'),
    ])
    setPlayers(p || [])
    setCategories(c || [])
  }

  function handleFile(e) {
    const f = e.target.files[0]
    if (!f) return
    setFile(f)
    setResult(null)
    setErrors([])

    const reader = new FileReader()
    reader.onload = (ev) => {
      const wb = XLSX.read(ev.target.result, { type: 'binary' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })
      parseAndValidate(rows)
    }
    reader.readAsBinaryString(f)
  }

  function parseAndValidate(rows) {
    const errs = []
    const matchMap = {} // key: fecha+mapa+resultado → match data

    rows.forEach((row, i) => {
      const r = i + 2 // Excel row number (header is row 1)
      const fecha = String(row['FECHA'] || row['fecha'] || '').trim()
      const mapa = String(row['MAPA'] || row['mapa'] || '').trim()
      const resultado = String(row['RESULTADO'] || row['resultado'] || '').toLowerCase().trim()
      const jugador = String(row['JUGADOR'] || row['jugador'] || '').trim()
      const categoria = String(row['CATEGORIA POROTO'] || row['CATEGORIA_POROTO'] || row['CATEGORIA'] || row['categoria'] || '').trim()
      const roundsUs = row['ROUNDS NUESTROS'] || row['ROUNDS_NUESTROS'] || ''
      const roundsThem = row['ROUNDS RIVALES'] || row['ROUNDS_RIVALES'] || ''
      const notas = String(row['NOTAS'] || row['notas'] || '').trim()

      // Skip empty rows
      if (!fecha && !mapa && !resultado) return

      if (!fecha) errs.push(`Fila ${r}: Falta la fecha`)
      if (!mapa) errs.push(`Fila ${r}: Falta el mapa`)
      else if (!VALORANT_MAPS.includes(mapa)) errs.push(`Fila ${r}: Mapa inválido "${mapa}"`)
      if (!resultado) errs.push(`Fila ${r}: Falta el resultado`)
      else if (!VALID_RESULTS.includes(resultado)) errs.push(`Fila ${r}: Resultado inválido "${resultado}"`)

      if (jugador && !players.find(p => p.name.toLowerCase() === jugador.toLowerCase())) {
        errs.push(`Fila ${r}: Jugador "${jugador}" no existe en la app`)
      }
      if (categoria && !categories.find(c => c.name.toLowerCase() === categoria.toLowerCase())) {
        errs.push(`Fila ${r}: Categoría "${categoria}" no existe en la app`)
      }
      if (jugador && !categoria) errs.push(`Fila ${r}: Hay jugador pero falta categoría`)
      if (categoria && !jugador) errs.push(`Fila ${r}: Hay categoría pero falta jugador`)

      const key = `${fecha}__${mapa}__${resultado}`
      if (!matchMap[key]) {
        matchMap[key] = {
          fecha, mapa, resultado,
          score_us: roundsUs !== '' ? parseInt(roundsUs) : null,
          score_them: roundsThem !== '' ? parseInt(roundsThem) : null,
          notas: notas || null,
          events: [],
          row: r,
        }
      }
      if (jugador && categoria) {
        matchMap[key].events.push({ jugador, categoria })
      }
      if (notas && matchMap[key].notas === null) matchMap[key].notas = notas
    })

    const matches = Object.values(matchMap)
    setErrors(errs)
    setPreview(matches)
  }

  async function handleImport() {
    if (errors.length > 0) return
    if (preview.length === 0) return
    setImporting(true)
    setResult(null)

    let imported = 0
    let skipped = 0
    let failed = 0

    for (const m of preview) {
      try {
        const { data: match, error: matchErr } = await supabase
          .from('matches')
          .insert({
            map: m.mapa,
            result: m.resultado,
            played_at: m.fecha,
            score_us: m.score_us,
            score_them: m.score_them,
            notes: m.notas,
          })
          .select().single()

        if (matchErr) { failed++; continue }

        // Infer players from events
        const playerNames = [...new Set(m.events.map(e => e.jugador))]
        const playerIds = playerNames.map(name =>
          players.find(p => p.name.toLowerCase() === name.toLowerCase())?.id
        ).filter(Boolean)

        if (playerIds.length > 0) {
          await supabase.from('match_players').insert(playerIds.map(pid => ({ match_id: match.id, player_id: pid })))
        }

        if (m.events.length > 0) {
          const eventsToInsert = m.events.map(ev => {
            const player = players.find(p => p.name.toLowerCase() === ev.jugador.toLowerCase())
            const cat = categories.find(c => c.name.toLowerCase() === ev.categoria.toLowerCase())
            return { match_id: match.id, player_id: player?.id, category_id: cat?.id, points: cat?.points || 0 }
          }).filter(e => e.player_id && e.category_id)

          if (eventsToInsert.length > 0) {
            await supabase.from('match_events').insert(eventsToInsert)
          }
        }

        imported++
      } catch (e) {
        failed++
      }
    }

    setImporting(false)
    setResult({ imported, failed })
    setFile(null)
    setPreview([])
    setErrors([])
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleBackup() {
    setBackingUp(true)
    try { await downloadBackup() }
    catch (e) { alert('Error al generar backup: ' + e.message) }
    setBackingUp(false)
  }

  return (
    <div>
      <h2>📥 Importar / Exportar</h2>

      <div className="tab-bar" style={{ marginBottom: 20 }}>
        <button className={`tab ${tab==='import'?'active':''}`} onClick={() => setTab('import')}>📥 Importar Excel</button>
        <button className={`tab ${tab==='backup'?'active':''}`} onClick={() => setTab('backup')}>💾 Backup</button>
      </div>

      {tab === 'import' && (
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <h3>Subir archivo Excel</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
              Usá la plantilla oficial para cargar partidas. Cada fila es un evento de poroto dentro de una partida.
            </p>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFile}
                style={{ flex: 1, minWidth: 200 }}
              />
            </div>
          </div>

          {errors.length > 0 && (
            <div className="card" style={{ marginBottom: 16, borderColor: 'rgba(255,70,85,0.4)', background: 'rgba(255,70,85,0.05)' }}>
              <h3 style={{ color: 'var(--accent)' }}>❌ Errores de validación ({errors.length})</h3>
              <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                {errors.map((e, i) => (
                  <div key={i} style={{ fontSize: 12, color: 'var(--accent)', padding: '3px 0', borderBottom: '1px solid rgba(255,70,85,0.15)' }}>{e}</div>
                ))}
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10 }}>Corregí los errores en el Excel antes de importar.</p>
            </div>
          )}

          {preview.length > 0 && errors.length === 0 && (
            <div className="card" style={{ marginBottom: 16, borderColor: 'rgba(34,211,165,0.3)', background: 'rgba(34,211,165,0.04)' }}>
              <h3 style={{ color: 'var(--accent-green)' }}>✓ Preview — {preview.length} partidas detectadas</h3>
              <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                {preview.map((m, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                    <span style={{ color: 'var(--text-muted)', minWidth: 90 }}>{m.fecha}</span>
                    <span style={{ color: 'var(--accent-blue)', minWidth: 70 }}>{m.mapa}</span>
                    <span className={`badge ${m.resultado==='victoria'?'badge-win':m.resultado==='derrota'?'badge-loss':'badge-draw'}`}>{m.resultado}</span>
                    {m.score_us != null && <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{m.score_us}–{m.score_them}</span>}
                    <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                      {m.events.length > 0 ? `${m.events.length} evento${m.events.length>1?'s':''}` : 'Sin eventos'}
                    </span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 16 }}>
                <button className="btn btn-primary" onClick={handleImport} disabled={importing}>
                  {importing ? 'Importando...' : `✓ Importar ${preview.length} partidas`}
                </button>
              </div>
            </div>
          )}

          {result && (
            <div className="card" style={{ borderColor: 'rgba(34,211,165,0.3)', background: 'rgba(34,211,165,0.04)' }}>
              <h3 style={{ color: 'var(--accent-green)' }}>✅ Importación completada</h3>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                <span style={{ color: 'var(--accent-green)', fontWeight: 600 }}>{result.imported} partidas importadas</span>
                {result.failed > 0 && <span style={{ color: 'var(--accent)', marginLeft: 12 }}>{result.failed} fallidas</span>}
              </p>
            </div>
          )}
        </div>
      )}

      {tab === 'backup' && (
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <h3>💾 Backup completo</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
              Descarga un Excel con todas las partidas, eventos, ranking de jugadores y categorías. Guardalo en un lugar seguro.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
              {[
                { icon: '📋', label: 'Hoja PARTIDAS', desc: 'Todas las partidas con eventos y jugadores' },
                { icon: '🏆', label: 'Hoja RANKING', desc: 'Porotos y stats por jugador' },
                { icon: '🏷️', label: 'Hoja CATEGORIAS', desc: 'Todas las categorías con sus puntos' },
              ].map((item, i) => (
                <div key={i} style={{ padding: '14px 16px', background: 'var(--bg-surface)', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 24, marginBottom: 6 }}>{item.icon}</div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', marginBottom: 4 }}>{item.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.desc}</div>
                </div>
              ))}
            </div>
            <button className="btn btn-primary" onClick={handleBackup} disabled={backingUp} style={{ fontSize: 14 }}>
              {backingUp ? 'Generando backup...' : '⬇️ Descargar Backup Excel'}
            </button>
          </div>

          <div className="card">
            <h3>📌 Recomendaciones de backup</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                '📅 Hacé backup al final de cada mes antes de que empiece el nuevo',
                '📁 Guardá el archivo en Google Drive o Dropbox con el nombre: porotitos_backup_YYYY-MM.xlsx',
                '🔄 El backup incluye todo: partidas, porotos, jugadores y categorías',
                '📥 Si la app se rompe, podés reimportar las partidas desde el backup usando la pestaña Importar',
              ].map((tip, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, padding: '10px 14px', background: 'var(--bg-surface)', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, color: 'var(--text-secondary)' }}>
                  {tip}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
