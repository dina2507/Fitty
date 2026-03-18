import { supabase } from '../lib/supabaseClient'

const SYNC_QUEUE_KEY = 'fitty_offline_sync_queue'

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
      let req = supabase.from(job.table)

      if (job.action === 'upsert') {
        req = req.upsert(job.payload)
      } else if (job.action === 'insert') {
        req = req.insert(job.payload)
      } else if (job.action === 'delete') {
        req = req.delete()
      } else if (job.action === 'update') {
        req = req.update(job.payload)
      }

      if (job.match) {
        req = req.match(job.match)
      }

      const { error } = await req

      if (error) {
        console.error(`Failed to sync queued job ${job.id}:`, error)
        // Stop processing further jobs to preserve write order
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
