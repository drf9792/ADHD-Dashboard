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
      if (!items.length)
