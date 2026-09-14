import { supabase, supabaseConfigured } from './supabase.js'

async function callSentryProxy(payload) {
  if (!supabaseConfigured) {
    throw new Error('Monitoring is only available when connected to Supabase (not in guest mode).')
  }
  const { data, error } = await supabase.functions.invoke('sentry-proxy', { body: payload })
  if (error) throw error
  return data
}

export function listIssues(query = 'is:unresolved') {
  return callSentryProxy({ resource: 'issues', action: 'list', data: { query } })
}

export function resolveIssue(id) {
  return callSentryProxy({ resource: 'issues', action: 'update', id, data: { status: 'resolved' } })
}

export function ignoreIssue(id) {
  return callSentryProxy({ resource: 'issues', action: 'update', id, data: { status: 'ignored' } })
}

export function reopenIssue(id) {
  return callSentryProxy({ resource: 'issues', action: 'update', id, data: { status: 'unresolved' } })
}

export function deleteIssue(id) {
  return callSentryProxy({ resource: 'issues', action: 'delete', id })
}

export function listUptimeMonitors() {
  return callSentryProxy({ resource: 'uptime', action: 'list' })
}

export function createUptimeMonitor({ name, url, intervalSeconds, timeoutMs }) {
  return callSentryProxy({
    resource: 'uptime',
    action: 'create',
    data: { name, url, intervalSeconds, timeoutMs },
  })
}

export function deleteUptimeMonitor(id) {
  return callSentryProxy({ resource: 'uptime', action: 'delete', id })
}
