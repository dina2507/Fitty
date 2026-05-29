import { create } from 'zustand'
import { createProgramSlice } from './slices/programSlice'
import { createWorkoutSlice } from './slices/workoutSlice'
import { createUserSlice } from './slices/userSlice'
import { createSyncSlice } from './slices/syncSlice'
import { createPlansSlice } from './slices/plansSlice'

export const useWorkoutStore = create((set, get) => ({
  ...createProgramSlice(set, get),
  ...createWorkoutSlice(set, get),
  ...createUserSlice(set, get),
  ...createSyncSlice(set, get),
  ...createPlansSlice(set, get),
}))
