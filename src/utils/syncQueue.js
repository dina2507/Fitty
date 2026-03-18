import { supabase } from '../lib/supabaseClient'

const SYNC_QUEUE_KEY = 'fitty_offline_sync_queue'
const LEGACY_PROGRESS_OPTIONAL_FIELDS = ['weight_unit', 'rest_timer_default', 'dismissed_alerts']

function isUserProgressColumnMismatch(error) {
  const message = String(error?.message || '')
  return error?.code === 'PGRST204' && message.includes('user_progress')
}

function stripLegacyProgressFields(payload) {
  if (!payload || typeof payload !== 'object') return payload
  const sanitized = { ...payload }
  LEGACY_PROGRESS_OPTIONAL_FIELDS.forEach((field) => {
    delete sanitized[field]
  })
  return sanitized
}

function deriveMatch(job) {
  if (job?.match) return job.match

  // Backward compatibility for older queued workout update jobs.
  if (job?.table === 'workout_logs' && job?.action === 'update') {
    const userId = job?.payload?.user_id
    const date = job?.payload?.date
    if (userId && date) {
      return { user_id: userId, date }
    }
  }

  return null
}

function buildRequest(job) {
  let req = supabase.from(job.table)

  if (job.action === 'upsert') {
    const upsertOptions = job.table === 'user_progress' ? { onConflict: 'user_id' } : undefined
    req = req.upsert(job.payload, upsertOptions)
  } else if (job.action === 'insert') {
    req = req.insert(job.payload)
  } else if (job.action === 'delete') {
    req = req.delete()
  } else if (job.action === 'update') {
    req = req.update(job.payload)
  }

  const match = deriveMatch(job)
  if (match) {
    req = req.match(match)
  }

  return req
}

/**
 * Ensures the queue exists in localStorage.
 * @returns {Array} List of pending mutation jobs.
 */
export function getSyncQueue() {
  try {
    const raw = localStorage.getItem(SYNC_QUEUE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

/**
 * Overwrites the queue.
 */
export function saveSyncQueue(queue) {
  localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue))
}

/**
 * Pushes a new mutation to the offline queue.
 * @param {string} table - Supabase table name
 * @param {string} action - 'upsert', 'insert', 'delete', etc.
 * @param {object} payload - Data payload
 * @param {object} match - Criteria for updaters or deleters (e.g. { user_id: '123' })
 */
export function enqueueMutation(table, action, payload, match = null) {
  const queue = getSyncQueue()
  queue.push({
    id: Date.now() + Math.random().toString(36).slice(2, 7),
    timestamp: new Date().toISOString(),
    table,
    action,
    payload,
    match
  })
  saveSyncQueue(queue)
}

/**
 * Attempts to flush the queue synchronously to Supabase.
 * Stops on the first failure to maintain order, or processes all.
 */
export async function flushSyncQueue() {
  if (!navigator.onLine) return false

  const queue = getSyncQueue()
  if (queue.length === 0) return true // Nothing to sync

  // Check auth early
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return false

  const remainingQueue = [...queue]

  for (const job of queue) {
    try {
      let requestJob = job
      let { error } = await buildRequest(requestJob)

      if (error && requestJob.table === 'user_progress' && requestJob.action === 'upsert' && isUserProgressColumnMismatch(error)) {
        requestJob = {
          ...requestJob,
          payload: stripLegacyProgressFields(requestJob.payload),
        }

        const fallbackResult = await buildRequest(requestJob)
        error = fallbackResult.error
      }

      if (error) {
        console.error(`Failed to sync queued job ${job.id}:`, error)
        // Stop processing further jobs to preserve write order.
        break
      }

      // Success! Remove from our working clone
      remainingQueue.shift()

    } catch (err) {
      console.error('Fatal network error during queue flush:', err)
      break
    }
  }

  saveSyncQueue(remainingQueue)
  return remainingQueue.length === 0
}
