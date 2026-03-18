import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../components/AuthProvider'
import { supabase } from '../lib/supabaseClient'
import { useWorkoutStore } from '../store/useWorkoutStore'
import { BADGES, checkMilestones } from '../utils/milestoneChecker'

function toBadgeMap(rows) {
  const map = {}
  ;(rows || []).forEach((row) => {
    if (!row?.badge_id) return
    map[row.badge_id] = row.earned_at || new Date().toISOString()
  })
  return map
}

export function useMilestones() {
  const { user } = useAuth()
  const enqueueMilestoneToasts = useWorkoutStore((state) => state.enqueueMilestoneToasts)

  const [earnedBadgeMap, setEarnedBadgeMap] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    async function fetchEarnedBadges() {
      if (!user?.id) {
        if (active) {
          setEarnedBadgeMap({})
          setLoading(false)
        }
        return
      }

      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('achievements')
          .select('badge_id, earned_at')
          .eq('user_id', user.id)

        if (error) throw error
        if (active) {
          setEarnedBadgeMap(toBadgeMap(data))
        }
      } catch (error) {
        console.error('Failed to fetch achievements:', error)
        if (active) setEarnedBadgeMap({})
      } finally {
        if (active) setLoading(false)
      }
    }

    fetchEarnedBadges()

    return () => {
      active = false
    }
  }, [user])

  const earnedBadgeIds = useMemo(() => new Set(Object.keys(earnedBadgeMap)), [earnedBadgeMap])

  const checkAndAward = useCallback(async (stats) => {
    const newlyEarnedIds = checkMilestones(stats, earnedBadgeIds)
    if (newlyEarnedIds.length === 0) return []

    const now = new Date().toISOString()

    if (user?.id) {
      try {
        const payload = newlyEarnedIds.map((badgeId) => ({
          user_id: user.id,
          badge_id: badgeId,
          earned_at: now,
        }))

        const { error } = await supabase
          .from('achievements')
          .upsert(payload, { onConflict: 'user_id,badge_id' })

        if (error) throw error
      } catch (error) {
        console.error('Failed to award achievements:', error)
      }
    }

    setEarnedBadgeMap((prev) => {
      const next = { ...prev }
      newlyEarnedIds.forEach((badgeId) => {
        next[badgeId] = now
      })
      return next
    })

    enqueueMilestoneToasts(newlyEarnedIds)

    return BADGES.filter((badge) => newlyEarnedIds.includes(badge.id))
  }, [earnedBadgeIds, enqueueMilestoneToasts, user])

  return {
    loading,
    earnedBadgeMap,
    earnedBadgeIds,
    checkAndAward,
  }
}
