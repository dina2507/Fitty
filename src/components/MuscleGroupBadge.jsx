import { getMuscleGroupColor } from '../utils/muscleGroups'

function MuscleGroupBadge({ group, subGroup, size = 'sm' }) {
  if (!group) return null

  const colors = getMuscleGroupColor(group)

  const sizeClasses = {
    xs: 'px-1.5 py-0.5 text-[10px]',
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${colors.bg} ${colors.text} ${sizeClasses[size] || sizeClasses.sm}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${colors.dot}`} />
      <span>{group}{subGroup ? <span className="opacity-75 font-normal"> · {subGroup}</span> : ''}</span>
    </span>
  )
}

export default MuscleGroupBadge
