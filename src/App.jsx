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

function formatDateTime(iso) {
  const d = new Date(iso)
  return (
    d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' at ' +
    d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  )
}

function daysUntil(iso) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(iso + 'T00:00:00')
  return Math.round((due - today) / 86400000)
}

function isDone(val) {
  return val === true || val === 'true' || val === 1
}

// ── Auth Screen ───────────────────────────────────────────────────────────────
function AuthScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState('login')
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    setLoading(true)
    setError(null)
    setMessage(null)
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
    } else {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setError(error.message)
      else setMessage('Check your email for a confirmation link.')
    }
    setLoading(false)
  }

  async function handleGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1>My Dashboard</h1>
        <p className="auth-subtitle">Sign in to access your tasks and recruiting pipeline.</p>
        <button className="google-btn" onClick={handleGoogle}>
          <svg width="18" height="18" viewBox="0 0 48 48" style={{ marginRight: 8 }}>
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          Continue with Google
        </button>
        <div className="auth-divider"><span>or</span></div>
        <input type="email" placeholder="Email address" value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()} />
        <input type="password" placeholder="Password" value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()} />
        {error && <p className="auth-error">{error}</p>}
        {message && <p className="auth-message">{message}</p>}
        <button className="auth-submit" onClick={handleSubmit} disabled={loading}>
          {loading ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Create account'}
        </button>
        <p className="auth-toggle">
          {mode === 'login' ? (
            <>Don't have an account? <button onClick={() => setMode('signup')}>Sign up</button></>
          ) : (
            <>Already have an account? <button onClick={() => setMode('login')}>Sign in</button></>
          )}
        </p>
      </div>
    </div>
  )
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [session, setSession] = useState(undefined)
  const [tasks, setTasks] = useState([])
  const [pipeline, setPipeline] = useState([])
  const [captureText, setCaptureText] = useState('')
  const [captureBucket, setCaptureBucket] = useState('someday')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showCompleted, setShowCompleted] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session) loadAll()
  }, [session])

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

  async function signOut() {
    await supabase.auth.signOut()
    setTasks([])
    setPipeline([])
  }

  // ── Tasks ─────────────────────────────────────────────────────────────────
  async function addTask() {
    const text = captureText.trim()
    if (!text) return
    setCaptureText('')
    const user_id = session.user.id
    const tempId = uid()
    setTasks((prev) => [...prev, { id: tempId, text, bucket: captureBucket, done: false, completed_at: null, user_id }])
    const { data, error } = await supabase
      .from('tasks')
      .insert({ text, bucket: captureBucket, done: false, completed_at: null, user_id })
      .select().single()
    if (error) { console.error(error); return }
    setTasks((prev) => prev.map((t) => (t.id === tempId ? data : t)))
  }

  async function addSplitTasks() {
    const raw = captureText.trim()
    if (!raw) return
    const pieces = raw.split(/\r?\n+|;+|,\s*/).map((s) => s.trim()).filter((s) => s.length > 0)
    if (pieces.length <= 1) { addTask(); return }
    setCaptureText('')
    const user_id = session.user.id
    for (const text of pieces) {
      const tempId = uid()
      setTasks((prev) => [...prev, { id: tempId, text, bucket: captureBucket, done: false, completed_at: null, user_id }])
      const { data, error } = await supabase
        .from('tasks').insert({ text, bucket: captureBucket, done: false, completed_at: null, user_id })
        .select().single()
      if (!error) setTasks((prev) => prev.map((t) => (t.id === tempId ? data : t)))
    }
  }
async function toggleTaskDone(id, checked) {
    const completed_at = checked ? new Date().toISOString() : null
    await supabase.from('tasks').update({ done: checked, completed_at }).eq('id', id)
    await loadAll()
  }
  
  async function updateTaskBucket(id, bucket) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, bucket } : t)))
    await supabase.from('tasks').update({ bucket }).eq('id', id)
  }

  async function deleteTask(id) {
    setTasks((prev) => prev.filter((t) => t.id !== id))
    await supabase.from('tasks').delete().eq('id', id)
  }

  // ── Pipeline ──────────────────────────────────────────────────────────────
  async function addPipelineEntry() {
    const user_id = session.user.id
    const tempId = uid()
    setPipeline((prev) => [...prev, { id: tempId, name: '', follow_up_date: null, next_action: '', notes: '', contact_log: [], user_id }])
    const { data, error } = await supabase
      .from('pipeline').insert({ name: '', next_action: '', notes: '', contact_log: [], user_id })
      .select().single()
    if (error) { console.error(error); return }
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
    setPipeline((prev) => prev.map((p) => {
      if (p.id !== id) return p
      updatedLog = [entry, ...(p.contact_log || [])]
      return { ...p, contact_log: updatedLog }
    }))
    await supabase.from('pipeline').update({ contact_log: updatedLog }).eq('id', id)
  }

  async function removeContactLog(id, entryId) {
    let updatedLog
    setPipeline((prev) => prev.map((p) => {
      if (p.id !== id) return p
      updatedLog = (p.contact_log || []).filter((e) => e.id !== entryId)
      return { ...p, contact_log: updatedLog }
    }))
    await supabase.from('pipeline').update({ contact_log: updatedLog }).eq('id', id)
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if (session === undefined) return <div className="container"><p>Loading...</p></div>
  if (!session) return <AuthScreen />
  if (loading) return <div className="container"><p>Loading your dashboard...</p></div>
  if (error) return <div className="container"><p className="error">Couldn't load data: {error}</p></div>

  const activeTasks = tasks.filter((t) => !isDone(t.done))
  const completedTasks = tasks
    .filter((t) => isDone(t.done))
    .sort((a, b) => new Date(b.completed_at || 0) - new Date(a.completed_at || 0))

  return (
    <div className="container">
      <div className="app-header">
        <h1>My Dashboard</h1>
        <div className="user-info">
          <span>{session.user.email}</span>
          <button onClick={signOut}>Sign out</button>
        </div>
      </div>

      {/* Brain dump */}
      <div className="capture-row">
        <textarea rows={2}
          placeholder="Brain dump: paste anything, even long lists separated by commas or new lines..."
          value={captureText}
          onChange={(e) => setCaptureText(e.target.value)} />
        <select value={captureBucket} onChange={(e) => setCaptureBucket(e.target.value)}>
          {BUCKETS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
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

      {/* Active task columns */}
      <div className="columns">
        {BUCKETS.map((bucket) => {
          const items = activeTasks.filter((t) => t.bucket === bucket.value)
          return (
            <div key={bucket.value} className={`column col-${bucket.value}`}>
              <p className="column-title">{bucket.label}</p>
              {items.length === 0 && <p className="empty">Nothing here yet.</p>}
              {items.map((t) => (
                <div key={t.id} className="task-row">
                  <input type="checkbox" checked={false}
                    onChange={(e) => toggleTaskDone(t.id, e.target.checked)} />
                  <span className="task-text">{t.text}</span>
                  <select value={t.bucket} onChange={(e) => updateTaskBucket(t.id, e.target.value)}>
                    {BUCKETS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
                  </select>
                  <button className="icon-btn" onClick={() => deleteTask(t.id)} aria-label="Delete">✕</button>
                </div>
              ))}
            </div>
          )
        })}
      </div>

      {/* Completed section */}
<p>Debug: {completedTasks.length} completed tasks</p>
<div className="completed-section">
        <button className="completed-toggle" onClick={() => setShowCompleted(!showCompleted)}>
          {showCompleted ? '▾' : '▸'} Completed ({completedTasks.length})
        </button>
        {showCompleted && (
          <div className="completed-list">
            {completedTasks.length === 0 && <p className="empty">Nothing completed yet.</p>}
            {completedTasks.map((t) => (
              <div key={t.id} className="task-row completed-row">
                <input type="checkbox" checked={true}
                  onChange={(e) => toggleTaskDone(t.id, e.target.checked)} />
                <span className="task-text done">{t.text}</span>
                <span className="completed-at">
                  {t.completed_at ? formatDateTime(t.completed_at) : ''}
                </span>
                <button className="icon-btn" onClick={() => deleteTask(t.id)} aria-label="Delete">✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recruiting pipeline */}
      <div className="pipeline-section">
        <div className="pipeline-header">
          <p className="section-title">Recruiting pipeline</p>
          <button onClick={addPipelineEntry}>+ Add candidate / role</button>
        </div>
        {pipeline.length === 0 && <p className="empty">No candidates or roles tracked yet.</p>}
        {pipeline.map((p) => (
          <div key={p.id} className="pipeline-card">
            <div className="pipeline-top-row">
              <input type="text" className="pipeline-name" placeholder="Candidate / role"
                value={p.name || ''}
                onChange={(e) => updatePipelineField(p.id, 'name', e.target.value)}
                onBlur={(e) => commitPipelineField(p.id, 'name', e.target.value)} />
              <div className="date-field">
                <label>Follow-up date</label>
                <input type="date" value={p.follow_up_date || ''}
                  onChange={(e) => {
                    updatePipelineField(p.id, 'follow_up_date', e.target.value)
                    commitPipelineField(p.id, 'follow_up_date', e.target.value || null)
                  }} />
              </div>
            </div>
            <input type="text" placeholder="Next action" value={p.next_action || ''}
              onChange={(e) => updatePipelineField(p.id, 'next_action', e.target.value)}
              onBlur={(e) => commitPipelineField(p.id, 'next_action', e.target.value)} />
            <textarea placeholder="Notes" rows={1} value={p.notes || ''}
              onChange={(e) => updatePipelineField(p.id, 'notes', e.target.value)}
              onBlur={(e) => commitPipelineField(p.id, 'notes', e.target.value)} />
            <div className="contact-log">
              <p className="log-label">Contact log</p>
              <div className="log-buttons">
                {CONTACT_TYPES.map((ct) => (
                  <button key={ct.value} className="log-btn"
                    onClick={() => addContactLog(p.id, ct.value, ct.label)}>
                    {ct.label}
                  </button>
                ))}
              </div>
              {(p.contact_log || []).map((entry) => (
                <div key={entry.id} className="log-entry">
                  <span>{formatDate(entry.date)} — {entry.label}</span>
                  <button className="icon-btn"
                    onClick={() => removeContactLog(p.id, entry.id)} aria-label="Remove">✕</button>
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
