import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

const BUCKETS = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'nextweek', label: 'Next week' },
  { value: 'someday', label: 'Someday' },
]

const CONTACT_TYPES = [
  { value: 'call_lm', label: 'Called - left message' },
  { value: 'text', label: 'Left text' },
  { value: 'email', label: 'Sent email' },
  { value: 'call_connected', label: 'Called - connected' },
]

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

function formatDate(iso) {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function daysUntil(iso) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(iso + 'T00:00:00')
  return Math.round((due - today) / 86400000)
}

export default function App() {
  const [tasks, setTasks] = useState([])
  const [pipeline, setPipeline] = useState([])
  const [captureText, setCaptureText] = useState('')
  const [captureBucket, setCaptureBucket] = useState('someday')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    setLoading(true)
    setError(null)
    try {
      const [taskRes, pipeRes] = await Promise.all([
        supabase.from('tasks').select('*').order('created_at', { ascending: true }),
        supabase.from('pipeline').select('*').order('follow_up_date', { ascending: true, nullsFirst: false }),
      ])
      if (taskRes.error) throw taskRes.error
      if (pipeRes.error) throw pipeRes.error
      setTasks(taskRes.data || [])
      setPipeline(pipeRes.data || [])
    } catch (err) {
      console.error(err)
      setError(err.message || 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  // ---- Tasks ----
  async function addTask() {
    const text = captureText.trim()
    if (!text) return
    setCaptureText('')
    const tempId = uid()
    const newTask = { id: tempId, text, bucket: captureBucket, done: false }
    setTasks((prev) => [...prev, newTask])
    const { data, error } = await supabase
      .from('tasks')
      .insert({ text, bucket: captureBucket, done: false })
      .select()
      .single()
    if (error) {
      console.error(error)
      return
    }
    setTasks((prev) => prev.map((t) => (t.id === tempId ? data : t)))
  }

  async function addSplitTasks() {
    const raw = captureText.trim()
    if (!raw) return
    const pieces = raw
      .split(/[\n;]+|,(?=\s)/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0)

    if (pieces.length <= 1) {
      addTask()
      return
    }

    setCaptureText('')
    for (const text of pieces) {
      const tempId = uid()
      setTasks((prev) => [...prev, { id: tempId, text, bucket: captureBucket, done: false }])
      const { data, error } = await supabase
        .from('tasks')
        .insert({ text, bucket: captureBucket, done: false })
        .select()
        .single()
      if (!error) {
        setTasks((prev) => prev.map((t) => (t.id === tempId ? data : t)))
      }
    }
  }

  async function updateTaskBucket(id, bucket) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, bucket } : t)))
    await supabase.from('tasks').update({ bucket }).eq('id', id)
  }

  async function toggleTaskDone(id, done) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done } : t)))
    await supabase.from('tasks').update({ done }).eq('id', id)
  }

  async function deleteTask(id) {
    setTasks((prev) => prev.filter((t) => t.id !== id))
    await supabase.from('tasks').delete().eq('id', id)
  }

  // ---- Pipeline ----
  async function addPipelineEntry() {
    const tempId = uid()
    const newEntry = {
      id: tempId,
      name: '',
      follow_up_date: null,
      next_action: '',
      notes: '',
      contact_log: [],
    }
    setPipeline((prev) => [...prev, newEntry])
    const { data, error } = await supabase
      .from('pipeline')
      .insert({ name: '', next_action: '', notes: '', contact_log: [] })
      .select()
      .single()
    if (error) {
      console.error(error)
      return
    }
    setPipeline((prev) => prev.map((p) => (p.id === tempId ? data : p)))
  }

  async function updatePipelineField(id, field, value) {
    setPipeline((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)))
  }

  async function commitPipelineField(id, field, value) {
    await supabase.from('pipeline').update({ [field]: value }).eq('id', id)
  }

  async function deletePipelineEntry(id) {
    setPipeline((prev) => prev.filter((p) => p.id !== id))
    await supabase.from('pipeline').delete().eq('id', id)
  }

  async function addContactLog(id, type, label) {
    const entry = { id: uid(), type, label, date: new Date().toISOString().slice(0, 10) }
    let updatedLog
    setPipeline((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p
        updatedLog = [entry, ...(p.contact_log || [])]
        return { ...p, contact_log: updatedLog }
      })
    )
    await supabase.from('pipeline').update({ contact_log: updatedLog }).eq('id', id)
  }

  async function removeContactLog(id, entryId) {
    let updatedLog
    setPipeline((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p
        updatedLog = (p.contact_log || []).filter((e) => e.id !== entryId)
        return { ...p, contact_log: updatedLog }
      })
    )
    await supabase.from('pipeline').update({ contact_log: updatedLog }).eq('id', id)
  }

  if (loading) {
    return <div className="container"><p>Loading your dashboard...</p></div>
  }

  if (error) {
    return (
      <div className="container">
        <p className="error">
          Couldn't load data: {error}
          <br />
          Check that VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set correctly,
          and that the schema has been run.
        </p>
      </div>
    )
  }

  const sortedTasks = [...tasks].sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0))

  return (
    <div className="container">
      <h1>My Dashboard</h1>

      <div className="capture-row">
        <textarea
          rows={2}
          placeholder="Brain dump: paste anything, even long lists separated by commas or new lines..."
          value={captureText}
          onChange={(e) => setCaptureText(e.target.value)}
        />
        <select value={captureBucket} onChange={(e) => setCaptureBucket(e.target.value)}>
          {BUCKETS.map((b) => (
            <option key={b.value} value={b.value}>
              {b.label}
            </option>
          ))}
        </select>
        <div className="capture-buttons">
          <button onClick={addTask}>+ Add as one item</button>
          <button onClick={addSplitTasks}>Split into tasks</button>
        </div>
      </div>
      <p className="hint">
        "Split into tasks" breaks pasted text into separate items by commas or line breaks —
        each lands in the bucket you selected, ready to re-sort individually.
      </p>

      <div className="columns">
        {BUCKETS.map((bucket) => {
          const items = sortedTasks.filter((t) => t.bucket === bucket.value)
          return (
            <div key={bucket.value} className={`column col-${bucket.value}`}>
              <p className="column-title">{bucket.label}</p>
              {items.length === 0 && <p className="empty">Nothing here yet.</p>}
              {items.map((t) => (
                <div key={t.id} className="task-row">
                  <input
                    type="checkbox"
                    checked={!!t.done}
                    onChange={(e) => toggleTaskDone(t.id, e.target.checked)}
                  />
                  <span className={t.done ? 'task-text done' : 'task-text'}>{t.text}</span>
                  <select
                    value={t.bucket}
                    onChange={(e) => updateTaskBucket(t.id, e.target.value)}
                  >
                    {BUCKETS.map((b) => (
                      <option key={b.value} value={b.value}>
                        {b.label}
                      </option>
                    ))}
                  </select>
                  <button className="icon-btn" onClick={() => deleteTask(t.id)} aria-label="Delete">
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )
        })}
      </div>

      <div className="pipeline-section">
        <div className="pipeline-header">
          <p className="section-title">Recruiting pipeline</p>
          <button onClick={addPipelineEntry}>+ Add candidate / role</button>
        </div>

        {pipeline.length === 0 && (
          <p className="empty">No candidates or roles tracked yet. Add one to get started.</p>
        )}

        {pipeline.map((p) => (
          <div key={p.id} className="pipeline-card">
            <div className="pipeline-top-row">
              <input
                type="text"
                className="pipeline-name"
                placeholder="Candidate / role"
                value={p.name || ''}
                onChange={(e) => updatePipelineField(p.id, 'name', e.target.value)}
                onBlur={(e) => commitPipelineField(p.id, 'name', e.target.value)}
              />
              <div className="date-field">
                <label>Follow-up date</label>
                <input
                  type="date"
                  value={p.follow_up_date || ''}
                  onChange={(e) => {
                    updatePipelineField(p.id, 'follow_up_date', e.target.value)
                    commitPipelineField(p.id, 'follow_up_date', e.target.value || null)
                  }}
                />
              </div>
            </div>

            <input
              type="text"
              placeholder="Next action"
              value={p.next_action || ''}
              onChange={(e) => updatePipelineField(p.id, 'next_action', e.target.value)}
              onBlur={(e) => commitPipelineField(p.id, 'next_action', e.target.value)}
            />

            <textarea
              placeholder="Notes"
              rows={1}
              value={p.notes || ''}
              onChange={(e) => updatePipelineField(p.id, 'notes', e.target.value)}
              onBlur={(e) => commitPipelineField(p.id, 'notes', e.target.value)}
            />

            <div className="contact-log">
              <p className="log-label">Contact log</p>
              <div className="log-buttons">
                {CONTACT_TYPES.map((ct) => (
                  <button
                    key={ct.value}
                    className="log-btn"
                    onClick={() => addContactLog(p.id, ct.value, ct.label)}
                  >
                    {ct.label}
                  </button>
                ))}
              </div>
              {(p.contact_log || []).map((entry) => (
                <div key={entry.id} className="log-entry">
                  <span>
                    {formatDate(entry.date)} — {entry.label}
                  </span>
                  <button className="icon-btn" onClick={() => removeContactLog(p.id, entry.id)} aria-label="Remove">
                    ✕
                  </button>
                </div>
              ))}
            </div>

            <div className="pipeline-bottom-row">
              <span className={dueLabelClass(p.follow_up_date)}>{dueLabelText(p.follow_up_date)}</span>
              <button onClick={() => deletePipelineEntry(p.id)}>Remove</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function dueLabelText(date) {
  if (!date) return 'No follow-up date set'
  const diff = daysUntil(date)
  if (diff < 0) return 'Overdue'
  if (diff === 0) return 'Follow up today'
  if (diff === 1) return 'Follow up tomorrow'
  return `Follow up in ${diff} days`
}

function dueLabelClass(date) {
  if (!date) return 'due-label'
  const diff = daysUntil(date)
  if (diff < 0) return 'due-label overdue'
  if (diff === 0) return 'due-label today'
  return 'due-label'
}
