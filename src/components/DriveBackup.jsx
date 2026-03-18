import { useMemo, useState } from 'react'
import {
  downloadBackupFromDrive,
  listBackupFiles,
  signInWithGoogle,
  signOutGoogle,
  uploadBackupToDrive,
} from '../lib/googleDrive'
import { useWorkoutStore } from '../store/useWorkoutStore'
import { storage } from '../utils/storage'

const UI_STATE = {
  IDLE: 'idle',
  SIGNING_IN: 'signing_in',
  BACKING_UP: 'backing_up',
  SUCCESS: 'success',
  RESTORING: 'restoring',
  ERROR: 'error',
}

function formatDateLabel(value) {
  if (!value) return 'Never'

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return 'Unknown'
  }

  return parsed.toLocaleString()
}

function Spinner() {
  return <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-600 dark:border-t-zinc-100" />
}

function DriveBackup() {
  const initializeStore = useWorkoutStore((state) => state.initializeStore)

  const [uiState, setUiState] = useState(UI_STATE.IDLE)
  const [errorMessage, setErrorMessage] = useState('')
  const [accessToken, setAccessToken] = useState('')
  const [restoreFiles, setRestoreFiles] = useState([])
  const [showRestoreList, setShowRestoreList] = useState(false)
  const [isDisconnecting, setIsDisconnecting] = useState(false)
  const [successMeta, setSuccessMeta] = useState(null)
  const [lastBackupTimestamp, setLastBackupTimestamp] = useState(
    () => localStorage.getItem('fitty_last_drive_backup') || '',
  )
  const [autoDriveBackup, setAutoDriveBackup] = useState(
    () => localStorage.getItem('fitty_auto_drive_backup') === 'true',
  )

  const isBusy = uiState === UI_STATE.SIGNING_IN
    || uiState === UI_STATE.BACKING_UP
    || uiState === UI_STATE.RESTORING

  const currentStatus = useMemo(() => {
    if (uiState === UI_STATE.SIGNING_IN) return 'Connecting to Google Drive...'
    if (uiState === UI_STATE.BACKING_UP) return 'Creating backup...'
    if (uiState === UI_STATE.RESTORING) return 'Restoring from backup...'
    return ''
  }, [uiState])

  async function getDriveAccessToken() {
    setUiState(UI_STATE.SIGNING_IN)
    const token = await signInWithGoogle()
    setAccessToken(token)
    return token
  }

  async function onBackupClick() {
    setErrorMessage('')
    setShowRestoreList(false)
    setSuccessMeta(null)

    try {
      const token = await getDriveAccessToken()
      setUiState(UI_STATE.BACKING_UP)

      const exportedData = storage.exportData()
      const uploadedFileId = await uploadBackupToDrive(exportedData, token)

      const latestFiles = await listBackupFiles(token)
      const uploadedFile = latestFiles.find((file) => file.id === uploadedFileId) || latestFiles[0]
      const backupTimestamp = uploadedFile?.createdTime || new Date().toISOString()

      localStorage.setItem('fitty_last_drive_backup', backupTimestamp)
      setLastBackupTimestamp(backupTimestamp)
      setSuccessMeta({
        name: uploadedFile?.name || 'fitty-backup.json',
        createdTime: backupTimestamp,
      })
      setUiState(UI_STATE.SUCCESS)
    } catch (error) {
      console.error('Google Drive backup failed:', error)
      setErrorMessage(error?.message || 'Google Drive backup failed. Please try again.')
      setUiState(UI_STATE.ERROR)
    }
  }

  async function onOpenRestoreListClick() {
    setErrorMessage('')
    setSuccessMeta(null)

    try {
      const token = await getDriveAccessToken()
      const files = await listBackupFiles(token)

      if (!files.length) {
        setErrorMessage('No backup files found in your Google Drive yet.')
        setUiState(UI_STATE.ERROR)
        setShowRestoreList(false)
        return
      }

      setRestoreFiles(files.slice(0, 10))
      setShowRestoreList(true)
      setUiState(UI_STATE.IDLE)
    } catch (error) {
      console.error('Failed to load backup list:', error)
      setErrorMessage(error?.message || 'Unable to load backup files.')
      setUiState(UI_STATE.ERROR)
      setShowRestoreList(false)
    }
  }

  async function onRestoreFileClick(file) {
    if (!file?.id) return

    const confirmed = window.confirm(
      'Restoring will replace your current local Fitty data with this backup. Continue?',
    )

    if (!confirmed) {
      return
    }

    setErrorMessage('')

    try {
      const token = await getDriveAccessToken()
      setUiState(UI_STATE.RESTORING)

      const restoredData = await downloadBackupFromDrive(file.id, token)
      storage.importData(restoredData)
      await initializeStore()

      const restoredAt = file.createdTime || new Date().toISOString()
      localStorage.setItem('fitty_last_drive_backup', restoredAt)
      setLastBackupTimestamp(restoredAt)
      setSuccessMeta({
        name: file.name,
        createdTime: restoredAt,
      })
      setShowRestoreList(false)
      setUiState(UI_STATE.SUCCESS)

      window.location.reload()
    } catch (error) {
      console.error('Restore from Google Drive failed:', error)
      setErrorMessage(error?.message || 'Restore failed. Please choose a different backup file.')
      setUiState(UI_STATE.ERROR)
    }
  }

  async function onDisconnectGoogle() {
    setErrorMessage('')
    setIsDisconnecting(true)

    try {
      await signOutGoogle()
      setAccessToken('')
      setUiState(UI_STATE.IDLE)
    } catch (error) {
      console.error('Google sign out failed:', error)
      setErrorMessage(error?.message || 'Failed to disconnect Google Drive.')
      setUiState(UI_STATE.ERROR)
    } finally {
      setIsDisconnecting(false)
    }
  }

  function onToggleAutoBackup() {
    const nextValue = !autoDriveBackup
    setAutoDriveBackup(nextValue)
    localStorage.setItem('fitty_auto_drive_backup', String(nextValue))
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50">
      <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">One-tap backup and restore</p>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        Fitty stores backup files in a Google Drive folder called "Fitty Backups".
      </p>

      {currentStatus && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
          <Spinner />
          <span>{currentStatus}</span>
        </div>
      )}

      {uiState === UI_STATE.SUCCESS && successMeta && (
        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-800/80 dark:bg-emerald-950/40 dark:text-emerald-200">
          <p className="font-semibold">✓ Backed up successfully</p>
          <p className="mt-1 text-xs">
            {successMeta.name} · {formatDateLabel(successMeta.createdTime)}
          </p>
        </div>
      )}

      {uiState === UI_STATE.ERROR && errorMessage && (
        <div className="mt-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
          {errorMessage}
        </div>
      )}

      <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
        Last backup: <span className="font-medium text-zinc-700 dark:text-zinc-200">{formatDateLabel(lastBackupTimestamp)}</span>
      </p>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          onClick={onBackupClick}
          disabled={isBusy}
          className="w-full rounded-full bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-50 sm:w-auto"
        >
          Backup to Google Drive
        </button>

        <button
          type="button"
          onClick={onOpenRestoreListClick}
          disabled={isBusy}
          className="w-full rounded-full border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 sm:w-auto"
        >
          Restore from Google Drive
        </button>

        <button
          type="button"
          onClick={onDisconnectGoogle}
          disabled={isBusy || isDisconnecting}
          className="w-full rounded-full border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 sm:w-auto"
        >
          {isDisconnecting ? 'Disconnecting...' : 'Disconnect Google'}
        </button>
      </div>

      <div className="mt-4 flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900">
        <div>
          <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">Auto-backup after workout completion</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Saves a fresh Drive backup after successful workout sync.
          </p>
        </div>
        <button
          type="button"
          onClick={onToggleAutoBackup}
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            autoDriveBackup
              ? 'bg-emerald-600 text-white hover:bg-emerald-700'
              : 'border border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800'
          }`}
        >
          {autoDriveBackup ? 'On' : 'Off'}
        </button>
      </div>

      {showRestoreList && (
        <div className="mt-4 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Choose a backup to restore</p>
            <button
              type="button"
              onClick={() => setShowRestoreList(false)}
              className="rounded-full border border-zinc-300 px-2.5 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Close
            </button>
          </div>

          <div className="mt-2 grid gap-2">
            {restoreFiles.map((file) => (
              <button
                key={file.id}
                type="button"
                onClick={() => onRestoreFileClick(file)}
                disabled={isBusy}
                className="flex items-center justify-between rounded-lg border border-zinc-200 px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                <span className="truncate">{file.name}</span>
                <span className="ml-3 shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
                  {formatDateLabel(file.createdTime)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default DriveBackup
