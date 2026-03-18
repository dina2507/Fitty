export function getNextDay(program, currentPhaseId, currentWeek, currentDayIndex) {
  const phaseIndex = program.phases.findIndex((phase) => phase.id === currentPhaseId)
  if (phaseIndex === -1) {
    return null
  }

  let nextPhaseIndex = phaseIndex
  let nextWeekIndex = currentWeek - 1
  let nextDay = currentDayIndex + 1

  while (nextPhaseIndex < program.phases.length) {
    const phase = program.phases[nextPhaseIndex]

    while (nextWeekIndex < phase.weeks.length) {
      const week = phase.weeks[nextWeekIndex]

      while (nextDay < week.days.length) {
        const day = week.days[nextDay]
        if (!day.isRest) {
          return {
            phaseId: phase.id,
            week: nextWeekIndex + 1,
            dayIndex: nextDay,
          }
        }
        nextDay += 1
      }

      nextWeekIndex += 1
      nextDay = 0
    }

    nextPhaseIndex += 1
    nextWeekIndex = 0
    nextDay = 0
  }

  return null
}

export function getCurrentDay(program, currentPhaseId, currentWeek, currentDayIndex) {
  const phase = program.phases.find((item) => item.id === currentPhaseId)
  if (!phase) {
    return null
  }

  const week = phase.weeks[currentWeek - 1]
  if (!week) {
    return null
  }

  return week.days[currentDayIndex] || null
}

export function calculateDaysIntoProgram(program, currentPhaseId, currentWeek, currentDayIndex) {
  let totalDays = 0

  for (const phase of program.phases) {
    if (phase.id === currentPhaseId) {
      // Count days in weeks before current week
      for (let w = 0; w < currentWeek - 1; w++) {
        const week = phase.weeks[w]
        totalDays += week.days.filter((day) => !day.isRest).length
      }

      // Count days in current week up to current day
      const currentWeekData = phase.weeks[currentWeek - 1]
      for (let d = 0; d <= currentDayIndex; d++) {
        if (!currentWeekData.days[d]?.isRest) {
          totalDays++
        }
      }
      return totalDays
    }

    // Count all days in completed phases
    for (const week of phase.weeks) {
      totalDays += week.days.filter((day) => !day.isRest).length
    }
  }

  return totalDays
}

export function getWeekDayProgress(week) {
  const workoutDays = week.days.filter(d => !d.isRest)
  return {
    total: workoutDays.length,
    completed: 0, // Will be populated by store
  }
}

export function isRestDay(programDay) {
  return programDay?.isRest || false
}

export function isSemiDeloadWeek(week) {
  return week?.isSemiDeload || false
}
