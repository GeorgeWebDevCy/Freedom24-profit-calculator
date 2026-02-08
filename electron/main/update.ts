import { createRequire } from 'node:module'
import type {
  AppUpdater,
  ProgressInfo,
  UpdateDownloadedEvent,
  UpdateInfo,
} from 'electron-updater'
import type { BrowserWindow, IpcMainInvokeEvent } from 'electron'

const require = createRequire(import.meta.url)
const electron = require('electron') as typeof import('electron')
const { app, ipcMain } = electron
let cachedAutoUpdater: AppUpdater | null = null

function resolveAutoUpdater(): AppUpdater | null {
  if (cachedAutoUpdater) return cachedAutoUpdater

  try {
    const mod = require('electron-updater') as { autoUpdater?: AppUpdater }
    cachedAutoUpdater = mod?.autoUpdater ?? null
  } catch (error) {
    console.warn('electron-updater is unavailable, update features are disabled', error)
    cachedAutoUpdater = null
  }

  return cachedAutoUpdater
}

export function update(win: BrowserWindow) {
  let listenersAttached = false

  const attachListeners = (autoUpdater: AppUpdater) => {
    if (listenersAttached) return
    listenersAttached = true

    // When set to false, the update download will be triggered through the API
    autoUpdater.autoDownload = false
    autoUpdater.disableWebInstaller = false
    autoUpdater.allowDowngrade = false

    // start check
    autoUpdater.on('checking-for-update', function () { })
    // update available
    autoUpdater.on('update-available', (arg: UpdateInfo) => {
      win.webContents.send('update-can-available', { update: true, version: app.getVersion(), newVersion: arg?.version })
    })
    // update not available
    autoUpdater.on('update-not-available', (arg: UpdateInfo) => {
      win.webContents.send('update-can-available', { update: false, version: app.getVersion(), newVersion: arg?.version })
    })
  }

  // Checking for updates
  ipcMain.handle('check-update', async () => {
    const autoUpdater = resolveAutoUpdater()
    if (!autoUpdater) {
      return {
        message: 'Auto-update is unavailable in this runtime.',
        error: new Error('electron-updater could not be loaded'),
      }
    }
    attachListeners(autoUpdater)

    if (!app.isPackaged) {
      const error = new Error('The update feature is only available after the package.')
      return { message: error.message, error }
    }

    try {
      return await autoUpdater.checkForUpdatesAndNotify()
    } catch (error) {
      return { message: 'Network error', error }
    }
  })

  // Start downloading and feedback on progress
  ipcMain.handle('start-download', (event: IpcMainInvokeEvent) => {
    const autoUpdater = resolveAutoUpdater()
    if (!autoUpdater) {
      event.sender.send('update-error', {
        message: 'Auto-update is unavailable in this runtime.',
        error: new Error('electron-updater could not be loaded'),
      })
      return
    }
    attachListeners(autoUpdater)

    startDownload(
      autoUpdater,
      (error, progressInfo) => {
        if (error) {
          // feedback download error message
          event.sender.send('update-error', { message: error.message, error })
        } else {
          // feedback update progress message
          event.sender.send('download-progress', progressInfo)
        }
      },
      () => {
        // feedback update downloaded message
        event.sender.send('update-downloaded')
      }
    )
  })

  // Install now
  ipcMain.handle('quit-and-install', () => {
    const autoUpdater = resolveAutoUpdater()
    if (!autoUpdater) return
    autoUpdater.quitAndInstall(false, true)
  })
}

function startDownload(
  autoUpdater: AppUpdater,
  callback: (error: Error | null, info: ProgressInfo | null) => void,
  complete: (event: UpdateDownloadedEvent) => void,
) {
  autoUpdater.on('download-progress', (info: ProgressInfo) => callback(null, info))
  autoUpdater.on('error', (error: Error) => callback(error, null))
  autoUpdater.on('update-downloaded', complete)
  autoUpdater.downloadUpdate()
}
