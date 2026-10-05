import { app, BrowserWindow, dialog, ipcMain, nativeImage, type NativeImage } from 'electron'
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'fs'
import { join } from 'path'
import { convertNcm } from './ncm'

const iconFile = 'maid in 彦斋.png'

function windowIcon(): NativeImage | undefined {
  const candidates = [
    join(app.getAppPath(), 'icon', iconFile),
    join(__dirname, '../../icon', iconFile)
  ]
  const iconPath = candidates.find((candidate) => existsSync(candidate))
  if (!iconPath) {
    return undefined
  }
  const image = nativeImage.createFromPath(iconPath)
  return image.isEmpty() ? undefined : image
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
}

function settingsFile(): string {
  return join(app.getPath('userData'), 'settings.json')
}

function readOutputDir(): string {
  try {
    const raw = readFileSync(settingsFile(), 'utf8')
    const parsed = JSON.parse(raw) as { outputDir?: string }
    return parsed.outputDir ?? ''
  } catch {
    return ''
  }
}

function writeOutputDir(outputDir: string): void {
  mkdirSync(app.getPath('userData'), { recursive: true })
  writeFileSync(settingsFile(), JSON.stringify({ outputDir }), 'utf8')
}

function collectNcm(paths: string[]): string[] {
  const found: string[] = []
  const visit = (target: string): void => {
    if (!existsSync(target)) {
      return
    }
    const info = statSync(target)
    if (info.isDirectory()) {
      for (const name of readdirSync(target)) {
        visit(join(target, name))
      }
      return
    }
    if (target.toLowerCase().endsWith('.ncm')) {
      found.push(target)
    }
  }
  for (const target of paths) {
    visit(target)
  }
  return found
}

function createWindow(): void {
  const window = new BrowserWindow({
    width: 920,
    height: 680,
    minWidth: 760,
    minHeight: 560,
    title: 'maid in 彦斋',
    backgroundColor: '#1A1A1A',
    autoHideMenuBar: true,
    icon: windowIcon(),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: false
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    window.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    window.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

if (process.platform === 'win32') {
  app.setAppUserModelId('com.yukimomo.ncm-client')
}

app.whenReady().then(() => {
  ipcMain.handle('output-dir:get', () => readOutputDir())
  ipcMain.handle('output-dir:set', (_event, outputDir: string) => {
    writeOutputDir(outputDir)
  })
  ipcMain.handle('files:pick', async () => {
    const result = await dialog.showOpenDialog({
      title: '添加 NCM 文件',
      filters: [{ name: 'NCM 文件', extensions: ['ncm'] }],
      properties: ['openFile', 'multiSelections']
    })
    return result.canceled ? [] : result.filePaths
  })
  ipcMain.handle('folder:pick', async () => {
    const result = await dialog.showOpenDialog({
      title: '添加文件夹',
      properties: ['openDirectory']
    })
    return result.canceled ? [] : collectNcm(result.filePaths)
  })
  ipcMain.handle('output:pick', async () => {
    const result = await dialog.showOpenDialog({
      title: '选择输出目录',
      properties: ['openDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) {
      return ''
    }
    writeOutputDir(result.filePaths[0])
    return result.filePaths[0]
  })
  ipcMain.handle('paths:collect', (_event, paths: string[]) => collectNcm(paths))
  ipcMain.handle('convert', async (event, files: string[], outputDir: string) => {
    writeOutputDir(outputDir)
    for (const file of files) {
      event.sender.send('convert-status', { path: file, status: '转换中' })
      try {
        const output = convertNcm(file, outputDir)
        event.sender.send('convert-status', { path: file, status: '完成', output })
      } catch (error) {
        const message = error instanceof Error && error.message ? error.message : '转换失败'
        event.sender.send('convert-status', { path: file, status: `失败：${message}` })
      }
    }
  })

  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
