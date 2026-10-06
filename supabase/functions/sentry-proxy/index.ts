// Authenticated proxy between the Optom Capital CRM and Sentry's REST API.
//
// The Sentry API token is a secret and must never reach the browser. This
// function holds it server-side and exposes only a fixed, narrow set of
// operations (never a raw passthrough), so the frontend can't do more than
// intended even if the client bundle were somehow tampered with.
//
// Confirmed against the live Sentry org (org slug "sbd-lk", project
// slug "optom-capital") before writing this:
//   Issues  — list:   GET  /projects/{org}/{project}/issues/
//             update: PUT  /organizations/{org}/issues/{id}/   { status }
//             delete: DELETE /organizations/{org}/issues/{id}/
//   Uptime  — list:   GET  /organizations/{org}/uptime/
//             create: POST /projects/{org}/{project}/uptime/   { name, url, intervalSeconds, timeoutMs }
//             update: PUT  /projects/{org}/{project}/uptime/{id}/
//             delete: DELETE /projects/{org}/{project}/uptime/{id}/

import { createClient } from 'jsr:@supabase/supabase-js@2'

const SENTRY_API_TOKEN = Deno.env.get('SENTRY_API_TOKEN')
const SENTRY_ORG = Deno.env.get('SENTRY_ORG') ?? 'sbd-lk'
const SENTRY_PROJECT = Deno.env.get('SENTRY_PROJECT') ?? 'optom-capital'
const SENTRY_API = 'https://sentry.io/api/0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function sentryFetch(path, init = {}) {
  const res = await fetch(`${SENTRY_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${SENTRY_API_TOKEN}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  })
  const text = await res.text()
  const data = text ? JSON.parse(text) : null
  if (!res.ok) throw { status: res.status, data }
  return data
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  // Require a logged-in Optom Capital user. Note: this app has no per-role
  // permission system, so any signed-in user can reach this — same as every
  // other page in the CRM today.
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Unauthorized' }, 401)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL'),
    Deno.env.get('SUPABASE_ANON_KEY'),
    { global: { headers: { Authorization: authHeader } } },
  )
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData?.user) return json({ error: 'Unauthorized' }, 401)

  if (!SENTRY_API_TOKEN) return json({ error: 'Sentry is not configured on the server' }, 500)

  let body = {}
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const { resource, action, id, data } = body

  try {
    // --- Issues ---
    if (resource === 'issues' && action === 'list') {
      const query = typeof data?.query === 'string' ? data.query : 'is:unresolved'
      const result = await sentryFetch(
        `/projects/${SENTRY_ORG}/${SENTRY_PROJECT}/issues/?query=${encodeURIComponent(query)}&limit=100&statsPeriod=14d`,
      )
      return json(result)
    }
    if (resource === 'issues' && action === 'update' && id) {
      const status = data?.status
      if (status !== 'resolved' && status !== 'ignored' && status !== 'unresolved') {
        return json({ error: 'status must be resolved, ignored, or unresolved' }, 400)
      }
      const result = await sentryFetch(`/organizations/${SENTRY_ORG}/issues/${id}/`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      })
      return json(result)
    }
    if (resource === 'issues' && action === 'delete' && id) {
      await sentryFetch(`/organizations/${SENTRY_ORG}/issues/${id}/`, { method: 'DELETE' })
      return json({ ok: true })
    }

    // --- Uptime monitors ---
    if (resource === 'uptime' && action === 'list') {
      const result = await sentryFetch(`/organizations/${SENTRY_ORG}/uptime/`)
      return json(result)
    }
    if (resource === 'uptime' && action === 'create') {
      const { name, url, intervalSeconds, timeoutMs } = data || {}
      if (!name || !url || !intervalSeconds || !timeoutMs) {
        return json({ error: 'name, url, intervalSeconds, and timeoutMs are required' }, 400)
      }
      const result = await sentryFetch(`/projects/${SENTRY_ORG}/${SENTRY_PROJECT}/uptime/`, {
        method: 'POST',
        body: JSON.stringify({ name, url, intervalSeconds, timeoutMs, method: 'GET' }),
      })
      return json(result)
    }
    if (resource === 'uptime' && action === 'update' && id) {
      const result = await sentryFetch(`/projects/${SENTRY_ORG}/${SENTRY_PROJECT}/uptime/${id}/`, {
        method: 'PUT',
        body: JSON.stringify(data || {}),
      })
      return json(result)
    }
    if (resource === 'uptime' && action === 'delete' && id) {
      await sentryFetch(`/projects/${SENTRY_ORG}/${SENTRY_PROJECT}/uptime/${id}/`, { method: 'DELETE' })
      return json({ ok: true })
    }

    return json({ error: 'Unknown resource/action' }, 400)
  } catch (e) {
    const status = e && typeof e === 'object' && 'status' in e ? e.status : 502
    const detail = e && typeof e === 'object' && 'data' in e ? e.data : { message: String(e) }
    return json({ error: 'Sentry API error', detail }, status >= 400 && status < 600 ? status : 502)
  }
})
