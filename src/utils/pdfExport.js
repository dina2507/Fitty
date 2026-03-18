import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

const PDF_MUSCLE_COLORS = {
  Chest: [192, 57, 43],
  Back: [26, 82, 118],
  Shoulders: [183, 149, 11],
  Biceps: [14, 102, 85],
  Triceps: [125, 60, 152],
  Quads: [31, 97, 141],
  Hamstrings: [202, 111, 30],
  Glutes: [113, 125, 126],
  Calves: [30, 132, 73],
  Core: [203, 67, 53],
  'Full Body': [44, 62, 80],
}

function toNumber(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeDate(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date
}

function getSetRows(exercise) {
  if (Array.isArray(exercise?.sets) && exercise.sets.length > 0) {
    return exercise.sets.map((set, index) => ({
      setNumber: set.setNumber || index + 1,
      weight: toNumber(set.weight),
      reps: toNumber(set.reps),
      rpe: set.rpe ?? '',
    }))
  }

  return [{
    setNumber: 1,
    weight: toNumber(exercise?.weight),
    reps: toNumber(exercise?.reps),
    rpe: exercise?.rpe ?? '',
  }]
}

function calculateWorkoutVolume(exercises) {
  return (exercises || []).reduce((sum, exercise) => {
    const setRows = getSetRows(exercise)
    return sum + setRows.reduce((setSum, set) => setSum + set.weight * set.reps, 0)
  }, 0)
}

function topPRsForMonth(workoutLogs) {
  const map = new Map()

  ;(workoutLogs || []).forEach((day) => {
    const date = normalizeDate(day.date)
    const dateLabel = date ? date.toLocaleDateString() : ''

    ;(day.exercises || []).forEach((exercise) => {
      const setRows = getSetRows(exercise)
      setRows.forEach((set) => {
        if (set.weight <= 0) return
        const key = exercise.name || 'Exercise'
        const current = map.get(key)
        if (!current || set.weight > current.maxWeight) {
          map.set(key, {
            exercise: key,
            maxWeight: set.weight,
            reps: set.reps,
            dateLabel,
          })
        }
      })
    })
  })

  return [...map.values()].sort((a, b) => b.maxWeight - a.maxWeight).slice(0, 5)
}

function getMonthlySummary(workoutLogs) {
  const summary = {
    setsByMuscle: {},
    volumeByMuscle: {},
    totalVolume: 0,
    totalSets: 0,
  }

  ;(workoutLogs || []).forEach((day) => {
    ;(day.exercises || []).forEach((exercise) => {
      const muscleGroup = exercise.muscleGroup || exercise.muscle_group || 'Full Body'
      const setRows = getSetRows(exercise)
      const setCount = setRows.length
      const volume = setRows.reduce((sum, set) => sum + set.weight * set.reps, 0)

      summary.totalSets += setCount
      summary.totalVolume += volume
      summary.setsByMuscle[muscleGroup] = (summary.setsByMuscle[muscleGroup] || 0) + setCount
      summary.volumeByMuscle[muscleGroup] = (summary.volumeByMuscle[muscleGroup] || 0) + volume
    })
  })

  return summary
}

function getConsistencyScore(workoutCount, month, year) {
  const daysInMonth = new Date(year, month, 0).getDate()
  const scheduledWorkouts = Math.max(1, Math.round((daysInMonth / 7) * 6))
  const score = Math.min(100, Number(((workoutCount / scheduledWorkouts) * 100).toFixed(1)))
  return {
    score,
    scheduledWorkouts,
  }
}

function addPageHeader(doc, title) {
  doc.setFontSize(11)
  doc.setTextColor(24, 24, 27)
  doc.text('Fitty - PPL Tracker', 40, 24)
  doc.setFontSize(10)
  doc.setTextColor(113, 113, 122)
  doc.text(title, 40, 38)
}

function addPageFooters(doc) {
  const pages = doc.getNumberOfPages()
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page)
    doc.setFontSize(9)
    doc.setTextColor(113, 113, 122)
    doc.text(`Page ${page} of ${pages}`, 555, 820, { align: 'right' })
  }
}

function downloadPdfBlob(blob, filename) {
  const safeName = filename?.endsWith('.pdf') ? filename : `${filename || 'report'}.pdf`
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = safeName
  document.body.appendChild(link)
  link.click()
  link.remove()

  setTimeout(() => URL.revokeObjectURL(url), 500)
}

export function generateMonthlyPDF(workoutLogs, userEmail, month, year) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })

  const logs = (workoutLogs || [])
    .slice()
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  })

  const summary = getMonthlySummary(logs)
  const topPRs = topPRsForMonth(logs)

  addPageHeader(doc, `${monthLabel} Report`)

  doc.setFontSize(24)
  doc.setTextColor(24, 24, 27)
  doc.text('Monthly Training Report', 40, 90)

  doc.setFontSize(11)
  doc.setTextColor(63, 63, 70)
  doc.text(`Athlete: ${userEmail || 'Unknown user'}`, 40, 116)
  doc.text(`Month: ${monthLabel}`, 40, 132)
  doc.text(`Workouts completed: ${logs.length}`, 40, 148)
  doc.text(`Total volume: ${Math.round(summary.totalVolume).toLocaleString()} kg`, 40, 164)

  const prRows = topPRs.length
    ? topPRs.map((item) => [item.exercise, `${item.maxWeight}kg x ${item.reps || '-'}`, item.dateLabel])
    : [['No PRs logged this month', '-', '-']]

  autoTable(doc, {
    startY: 190,
    head: [['Top PRs This Month', 'Best Set', 'Date']],
    body: prRows,
    styles: { fontSize: 9, cellPadding: 5 },
    headStyles: { fillColor: [24, 24, 27] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  })

  logs.forEach((day) => {
    doc.addPage()

    const date = normalizeDate(day.date)
    const dateLabel = date ? date.toLocaleDateString() : 'Unknown date'
    const workoutName = day.label || day.workout_name || day.day_label || 'Workout'
    const duration = day.durationMinutes || day.duration_minutes || '-'

    addPageHeader(doc, `${monthLabel} Report`)

    const firstGroup = (day.exercises || []).find((exercise) => exercise.muscleGroup || exercise.muscle_group)?.muscleGroup || 'Full Body'
    const color = PDF_MUSCLE_COLORS[firstGroup] || PDF_MUSCLE_COLORS['Full Body']

    doc.setFontSize(14)
    doc.setTextColor(color[0], color[1], color[2])
    doc.text(`${dateLabel} - ${workoutName}`, 40, 74)

    doc.setFontSize(10)
    doc.setTextColor(63, 63, 70)
    doc.text(`Duration: ${duration} min`, 40, 92)

    const tableRows = []
    ;(day.exercises || []).forEach((exercise) => {
      const setRows = getSetRows(exercise)
      setRows.forEach((set) => {
        tableRows.push([
          exercise.name || '',
          set.setNumber,
          set.weight ? `${set.weight}kg` : '-',
          set.reps || '-',
          set.rpe || '-',
          set.weight && set.reps ? `${Math.round(set.weight * set.reps)}` : '-',
        ])
      })
    })

    if (tableRows.length === 0) {
      tableRows.push(['No logged sets', '-', '-', '-', '-', '-'])
    }

    autoTable(doc, {
      startY: 106,
      head: [['Exercise', 'Set', 'Weight', 'Reps', 'RPE', 'Volume']],
      body: tableRows,
      styles: { fontSize: 8.5, cellPadding: 4 },
      headStyles: { fillColor: [24, 24, 27] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 40, right: 40 },
    })

    const notes = day.sessionNotes || day.session_notes || day.notes
    if (notes) {
      const finalY = doc.lastAutoTable?.finalY || 120
      doc.setFontSize(10)
      doc.setTextColor(63, 63, 70)
      doc.text('Session Notes:', 40, finalY + 20)
      doc.setTextColor(24, 24, 27)
      const splitNotes = doc.splitTextToSize(notes, 515)
      doc.text(splitNotes, 40, finalY + 36)
    }
  })

  doc.addPage()
  addPageHeader(doc, `${monthLabel} Report`)

  doc.setFontSize(14)
  doc.setTextColor(24, 24, 27)
  doc.text('Monthly Summary', 40, 74)

  const summaryRows = Object.keys(summary.setsByMuscle)
    .sort((a, b) => (summary.volumeByMuscle[b] || 0) - (summary.volumeByMuscle[a] || 0))
    .map((muscle) => {
      return [
        muscle,
        summary.setsByMuscle[muscle] || 0,
        Math.round(summary.volumeByMuscle[muscle] || 0),
      ]
    })

  autoTable(doc, {
    startY: 88,
    head: [['Muscle Group', 'Total Sets', 'Total Volume (kg)']],
    body: summaryRows.length ? summaryRows : [['No data', '-', '-']],
    styles: { fontSize: 9, cellPadding: 5 },
    headStyles: { fillColor: [24, 24, 27] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 40, right: 40 },
  })

  const prsRows = topPRs.length
    ? topPRs.map((item) => [item.exercise, `${item.maxWeight}kg x ${item.reps || '-'}`, item.dateLabel])
    : [['No PRs logged this month', '-', '-']]

  autoTable(doc, {
    startY: (doc.lastAutoTable?.finalY || 100) + 24,
    head: [['PRs Hit This Month', 'Best Set', 'Date']],
    body: prsRows,
    styles: { fontSize: 9, cellPadding: 5 },
    headStyles: { fillColor: [24, 24, 27] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 40, right: 40 },
  })

  const { score, scheduledWorkouts } = getConsistencyScore(logs.length, month, year)
  const summaryY = (doc.lastAutoTable?.finalY || 500) + 28

  doc.setFontSize(11)
  doc.setTextColor(24, 24, 27)
  doc.text(`Consistency Score: ${score}%`, 40, summaryY)
  doc.setFontSize(10)
  doc.setTextColor(63, 63, 70)
  doc.text(`(${logs.length} completed / ${scheduledWorkouts} scheduled workouts)`, 40, summaryY + 16)

  addPageFooters(doc)

  const filename = `monthly-report-${year}-${String(month).padStart(2, '0')}.pdf`

  try {
    const blob = doc.output('blob')
    downloadPdfBlob(blob, filename)
  } catch (error) {
    // Fallback keeps exports working in environments where blob output is restricted.
    console.error('PDF blob export failed, using jsPDF save fallback:', error)
    doc.save(filename)
  }
}
