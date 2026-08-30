// Vercel Serverless Function: sends a daily summary email.
// Triggered by Vercel Cron (see vercel.json) or by visiting /api/daily-summary?key=YOUR_SECRET

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY // service role key (server-side only)
const RESEND_API_KEY = process.env.RESEND_API_KEY
const SUMMARY_TO = process.env.SUMMARY_TO_EMAIL
const SUMMARY_FROM = process.env.SUMMARY_FROM_EMAIL || 'onboarding@resend.dev'
const DASHBOARD_USER_ID = process.env.DASHBOARD_USER_ID // whose tasks to summarize
const CRON_SECRET = process.env.CRON_SECRET

function esc(s) {
  return String(s || '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))
}

export default async function handler(req, res) {
  // Simple protection so randoms can't trigger your email
  const provided = req.query.key || req.headers['authorization']?.replace('Bearer ', '')
  if (CRON_SECRET && provided !== CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // Fetch tasks for the user
    const { data: tasks, error: taskErr } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', DASHBOARD_USER_ID)
      .eq('done', false)
    if (taskErr) throw taskErr

    // Fetch pipeline for overdue follow-ups
    const { data: pipeline, error: pipeErr } = await supabase
      .from('pipeline')
      .select('*')
      .eq('user_id', DASHBOARD_USER_ID)
    if (pipeErr) throw pipeErr

    const todayTasks = (tasks || []).filter((t) => t.bucket === 'today')
    const weekTasks = (tasks || []).filter((t) => t.bucket === 'week')

    const todayStr = new Date().toISOString().slice(0, 10)
    const overdue = (pipeline || []).filter(
      (p) => p.follow_up_date && p.follow_up_date < todayStr
    )

    // Build the email HTML
    const section = (title, items, render) => {
      if (!items.length) return `<h3 style="margin:18px 0 6px;font-size:15px;color:#333">${title}</h3><p style="margin:0;color:#888;font-size:14px">Nothing here.</p>`
      return `<h3 style="margin:18px 0 6px;font-size:15px;color:#333">${title}</h3><ul style="margin:0;padding-left:20px">${items.map(render).join('')}</ul>`
    }

    const dateLabel = new Date().toLocaleDateString(undefined, {
      weekday: 'long', month: 'long', day: 'numeric',
    })

    const html = `
      <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:600px;margin:0 auto;color:#2b2b2f">
        <h2 style="font-size:18px;margin:0 0 4px">Your day — ${dateLabel}</h2>
        <p style="margin:0;color:#888;font-size:13px">From your dashboard</p>
        ${section('Today', todayTasks, (t) => `<li style="margin:4px 0;font-size:14px">${esc(t.text)}</li>`)}
        ${section('This week', weekTasks, (t) => `<li style="margin:4px 0;font-size:14px">${esc(t.text)}</li>`)}
        ${section('Overdue follow-ups', overdue, (p) => `<li style="margin:4px 0;font-size:14px">${esc(p.name || 'Unnamed')}${p.next_action ? ' — ' + esc(p.next_action) : ''} <span style="color:#c4453c">(due ${esc(p.follow_up_date)})</span></li>`)}
        <p style="margin:24px 0 0"><a href="https://adhd-dashboard-seven.vercel.app" style="color:#2f6fb0;font-size:14px">Open dashboard →</a></p>
      </div>
    `

    // Send via Resend
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: SUMMARY_FROM,
        to: SUMMARY_TO,
        subject: `Your day — ${dateLabel}`,
        html,
      }),
    })

    if (!resp.ok) {
      const errText = await resp.text()
      throw new Error('Resend error: ' + errText)
    }

    return res.status(200).json({ ok: true, today: todayTasks.length, week: weekTasks.length, overdue: overdue.length })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: err.message })
  }
}
