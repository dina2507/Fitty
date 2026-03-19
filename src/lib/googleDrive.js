/*
SETUP REQUIRED (one-time, done by the developer):
1. Go to https://console.cloud.google.com
2. Create a new project called "Fitty"
3. Go to APIs & Services -> Enable APIs -> enable "Google Drive API"
4. Go to APIs & Services -> Credentials -> Create Credentials -> OAuth 2.0 Client ID
5. Application type: Web application
6. Authorised JavaScript origins: add https://your-vercel-domain.vercel.app AND http://localhost:5173
7. Copy the Client ID and add it to .env as VITE_GOOGLE_CLIENT_ID
8. Go to APIs & Services -> OAuth consent screen -> add your email as a test user
*/

const GOOGLE_GAPI_SCRIPT_SRC = 'https://apis.google.com/js/api.js'
const GOOGLE_GIS_SCRIPT_SRC = 'https://accounts.google.com/gsi/client'
const DRIVE_DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file'
const DRIVE_FOLDER_NAME = 'Fitty Backups'
const BACKUP_PREFIX = 'fitty-backup'
const AUTO_BACKUP_SEGMENT = 'auto'
const TOKEN_STORAGE_KEY = 'fitty_google_drive_access_token'
const TOKEN_EXPIRES_AT_STORAGE_KEY = 'fitty_google_drive_access_token_expires_at'
const AUTOMATIC_BACKUP_KEEP_COUNT = 5
const DEFAULT_BACKUP_KEEP_COUNT = 10

let googleScriptsPromise = null
let googleTokenClient = null
let googleAccessToken = null
let googleTokenExpiresAt = 0
let signInPromise = null

function readPersistedToken() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return
  }

  try {
    const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY)
    const storedExpiresAt = Number(localStorage.getItem(TOKEN_EXPIRES_AT_STORAGE_KEY) || 0)

    if (!storedToken || !Number.isFinite(storedExpiresAt) || Date.now() >= storedExpiresAt - 30_000) {
      localStorage.removeItem(TOKEN_STORAGE_KEY)
      localStorage.removeItem(TOKEN_EXPIRES_AT_STORAGE_KEY)
      return
    }

    googleAccessToken = storedToken
    googleTokenExpiresAt = storedExpiresAt
  } catch {
    // Ignore storage read failures.
  }
}

readPersistedToken()

function getGoogleClientId() {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
  if (!clientId) {
    throw new Error(
      'Missing VITE_GOOGLE_CLIENT_ID. Add your Google OAuth Client ID to .env before using Drive backup.',
    )
  }
  return clientId
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`)
    if (existing) {
      const isAlreadyAvailable = src === GOOGLE_GAPI_SCRIPT_SRC
        ? Boolean(window.gapi)
        : Boolean(window.google?.accounts?.oauth2)

      if (isAlreadyAvailable) {
        existing.dataset.loaded = 'true'
        resolve()
        return
      }

      if (existing.dataset.loaded === 'true') {
        resolve()
        return
      }

      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error(`Failed to load script: ${src}`)), { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.defer = true
    script.onload = () => {
      script.dataset.loaded = 'true'
      resolve()
    }
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`))
    document.head.appendChild(script)
  })
}

function formatGoogleApiError(payload, fallbackStatus) {
  if (!payload) {
    return fallbackStatus || 'Google Drive request failed.'
  }

  try {
    const parsed = JSON.parse(payload)
    const message = parsed?.error?.message || parsed?.error_description
    if (message) return message
  } catch {
    // Fall through to plain text.
  }

  return payload || fallbackStatus || 'Google Drive request failed.'
}

function toISODateOrNow(value) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString()
  }
  return parsed.toISOString()
}

function setToken(accessToken, expiresInSeconds = 0) {
  googleAccessToken = accessToken || null

  if (googleAccessToken) {
    const ttl = Number.isFinite(Number(expiresInSeconds)) && Number(expiresInSeconds) > 0
      ? Number(expiresInSeconds)
      : 3600
    googleTokenExpiresAt = Date.now() + ttl * 1000

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem(TOKEN_STORAGE_KEY, googleAccessToken)
        localStorage.setItem(TOKEN_EXPIRES_AT_STORAGE_KEY, String(googleTokenExpiresAt))
      } catch {
        // Ignore storage write failures.
      }
    }

    if (window.gapi?.client?.setToken) {
      window.gapi.client.setToken({ access_token: googleAccessToken })
    }
    return
  }

  googleTokenExpiresAt = 0

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.removeItem(TOKEN_STORAGE_KEY)
      localStorage.removeItem(TOKEN_EXPIRES_AT_STORAGE_KEY)
    } catch {
      // Ignore storage write failures.
    }
  }

  if (window.gapi?.client?.setToken) {
    window.gapi.client.setToken(null)
  }
}

function hasValidToken() {
  return Boolean(googleAccessToken) && Date.now() < (googleTokenExpiresAt - 30_000)
}

function buildGoogleUrl(path, query = {}) {
  const url = new URL(`https://www.googleapis.com${path}`)
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value))
    }
  })
  return url.toString()
}

async function googleRequest(path, { method = 'GET', accessToken, query, headers = {}, body, raw = false } = {}) {
  const token = accessToken || googleAccessToken
  if (!token) {
    throw new Error('Google Drive access token is missing. Please sign in again.')
  }

  const response = await fetch(buildGoogleUrl(path, query), {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...headers,
    },
    body,
  })

  if (!response.ok) {
    const payload = await response.text()
    throw new Error(formatGoogleApiError(payload, `${response.status} ${response.statusText}`))
  }

  if (raw) {
    return response
  }

  if (response.status === 204) {
    return null
  }

  const text = await response.text()
  return text ? JSON.parse(text) : null
}

function getBackupFileName(timestamp = new Date(), { automatic = false } = {}) {
  const year = timestamp.getFullYear()
  const month = String(timestamp.getMonth() + 1).padStart(2, '0')
  const day = String(timestamp.getDate()).padStart(2, '0')
  const hour = String(timestamp.getHours()).padStart(2, '0')
  const minute = String(timestamp.getMinutes()).padStart(2, '0')
  const modeSegment = automatic ? `-${AUTO_BACKUP_SEGMENT}` : ''
  return `${BACKUP_PREFIX}${modeSegment}-${year}-${month}-${day}-${hour}-${minute}.json`
}

async function getBackupFolderId(accessToken, { createIfMissing = false } = {}) {
  const escapedFolderName = DRIVE_FOLDER_NAME.replace(/'/g, "\\'")
  const q = [
    "mimeType='application/vnd.google-apps.folder'",
    `name='${escapedFolderName}'`,
    'trashed=false',
  ].join(' and ')

  const result = await googleRequest('/drive/v3/files', {
    accessToken,
    query: {
      q,
      fields: 'files(id,name,createdTime)',
      pageSize: 1,
      orderBy: 'createdTime desc',
    },
  })

  const folderId = result?.files?.[0]?.id
  if (folderId) return folderId
  if (!createIfMissing) return null

  const created = await googleRequest('/drive/v3/files', {
    method: 'POST',
    accessToken,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: DRIVE_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  })

  if (!created?.id) {
    throw new Error('Failed to create Google Drive backup folder.')
  }

  return created.id
}

// Load the Google Identity Services + GAPI scripts dynamically (only once)
export async function loadGoogleScripts() {
  getGoogleClientId()

  if (!googleScriptsPromise) {
    googleScriptsPromise = (async () => {
      await Promise.all([
        loadScript(GOOGLE_GAPI_SCRIPT_SRC),
        loadScript(GOOGLE_GIS_SCRIPT_SRC),
      ])

      if (!window.gapi) {
        throw new Error('Google API client (gapi) is not available after script load.')
      }

      await new Promise((resolve, reject) => {
        window.gapi.load('client', {
          callback: resolve,
          onerror: () => reject(new Error('Failed to initialize the Google API client loader.')),
        })
      })

      await window.gapi.client.init({
        discoveryDocs: [DRIVE_DISCOVERY_DOC],
      })
    })().catch((error) => {
      googleScriptsPromise = null
      throw error
    })
  }

  return googleScriptsPromise
}

// Open OAuth popup, get access token with Drive file scope
// Scope needed: https://www.googleapis.com/auth/drive.file
// (drive.file = only files created by this app, not the user's whole Drive)
export async function signInWithGoogle() {
  if (hasValidToken()) {
    return googleAccessToken
  }

  if (signInPromise) {
    return signInPromise
  }

  await loadGoogleScripts()

  if (!window.google?.accounts?.oauth2) {
    throw new Error('Google Identity Services is not available.')
  }

  if (!googleTokenClient) {
    googleTokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: getGoogleClientId(),
      scope: DRIVE_SCOPE,
      callback: () => {},
      error_callback: () => {},
    })
  }

  signInPromise = new Promise((resolve, reject) => {
    googleTokenClient.callback = (response) => {
      if (!response || response.error) {
        const message = response?.error_description || response?.error || 'Google sign-in failed.'
        reject(new Error(message))
        return
      }

      const nextToken = response.access_token
      if (!nextToken) {
        reject(new Error('Google sign-in did not return an access token.'))
        return
      }

      setToken(nextToken, response.expires_in)
      resolve(nextToken)
    }

    googleTokenClient.error_callback = (error) => {
      const message = error?.message || 'Google sign-in was cancelled.'
      reject(new Error(message))
    }

    googleTokenClient.requestAccessToken({ prompt: googleAccessToken ? '' : 'consent' })
  }).finally(() => {
    signInPromise = null
  })

  return signInPromise
}

// Sign out / revoke token
export async function signOutGoogle() {
  const tokenToRevoke = googleAccessToken || window.gapi?.client?.getToken?.()?.access_token
  setToken(null)

  if (!tokenToRevoke || !window.google?.accounts?.oauth2?.revoke) {
    return
  }

  await new Promise((resolve) => {
    window.google.accounts.oauth2.revoke(tokenToRevoke, () => resolve())
  })
}

// Upload a JSON backup file to a folder called "Fitty Backups" in the user's Drive
// File name format: fitty-backup-YYYY-MM-DD-HH-MM.json
// If the folder doesn't exist, create it first
// Returns the uploaded file's Drive ID
export async function uploadBackupToDrive(data, accessToken, options = {}) {
  const { automatic = false } = options
  const token = accessToken || await signInWithGoogle()
  const folderId = await getBackupFolderId(token, { createIfMissing: true })
  const fileName = getBackupFileName(new Date(), { automatic })
  const boundary = `fitty_backup_${Math.random().toString(36).slice(2)}`

  const metadata = {
    name: fileName,
    parents: [folderId],
    mimeType: 'application/json',
  }

  const payload = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(metadata),
    `--${boundary}`,
    'Content-Type: application/json',
    '',
    JSON.stringify(data),
    `--${boundary}--`,
    '',
  ].join('\r\n')

  const created = await googleRequest('/upload/drive/v3/files', {
    method: 'POST',
    accessToken: token,
    query: {
      uploadType: 'multipart',
      fields: 'id,name,createdTime',
    },
    headers: {
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: payload,
  })

  if (!created?.id) {
    throw new Error('Google Drive backup upload did not return a file ID.')
  }

  // Keep only the recent backup history required by mode.
  await pruneOldBackups(token, {
    automaticOnly: automatic,
    keepCount: automatic ? AUTOMATIC_BACKUP_KEEP_COUNT : DEFAULT_BACKUP_KEEP_COUNT,
  })

  return created.id
}

export async function uploadAutomaticBackupToDrive(data, accessToken) {
  return uploadBackupToDrive(data, accessToken, { automatic: true })
}

// List all backup files in the "Fitty Backups" folder, sorted newest first
// Returns array of { id, name, createdTime }
export async function listBackupFiles(accessToken) {
  const token = accessToken || await signInWithGoogle()
  const folderId = await getBackupFolderId(token, { createIfMissing: false })

  if (!folderId) {
    return []
  }

  const q = [
    `'${folderId}' in parents`,
    "mimeType='application/json'",
    `name contains '${BACKUP_PREFIX}'`,
    'trashed=false',
  ].join(' and ')

  const result = await googleRequest('/drive/v3/files', {
    accessToken: token,
    query: {
      q,
      fields: 'files(id,name,createdTime)',
      pageSize: 100,
      orderBy: 'createdTime desc',
    },
  })

  return (result?.files || [])
    .map((file) => ({
      id: file.id,
      name: file.name,
      createdTime: toISODateOrNow(file.createdTime),
    }))
    .sort((a, b) => new Date(b.createdTime).getTime() - new Date(a.createdTime).getTime())
}

// Download a specific backup file by Drive file ID
// Returns the parsed JSON object
export async function downloadBackupFromDrive(fileId, accessToken) {
  if (!fileId) {
    throw new Error('Missing Google Drive file ID.')
  }

  const token = accessToken || await signInWithGoogle()
  const response = await googleRequest(`/drive/v3/files/${encodeURIComponent(fileId)}`, {
    accessToken: token,
    query: {
      alt: 'media',
    },
    raw: true,
  })

  const text = await response.text()
  try {
    return JSON.parse(text)
  } catch {
    throw new Error('Backup file is not valid JSON.')
  }
}

// Delete old backups — keep only the 10 most recent files
// Call this after every successful upload
export async function pruneOldBackups(accessToken, options = {}) {
  const { automaticOnly = false, keepCount = DEFAULT_BACKUP_KEEP_COUNT } = options
  const token = accessToken || await signInWithGoogle()
  const backups = await listBackupFiles(token)
  const filteredBackups = automaticOnly
    ? backups.filter((file) => String(file?.name || '').includes(`${BACKUP_PREFIX}-${AUTO_BACKUP_SEGMENT}-`))
    : backups
  const normalizedKeepCount = Number.isFinite(Number(keepCount))
    ? Math.max(1, Number(keepCount))
    : DEFAULT_BACKUP_KEEP_COUNT
  const staleBackups = filteredBackups.slice(normalizedKeepCount)

  await Promise.all(
    staleBackups.map((file) =>
      googleRequest(`/drive/v3/files/${encodeURIComponent(file.id)}`, {
        method: 'DELETE',
        accessToken: token,
      }),
    ),
  )

  return staleBackups.length
}
