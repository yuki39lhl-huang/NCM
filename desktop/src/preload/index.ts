import { contextBridge, ipcRenderer, webUtils } from 'electron'

interface ConvertStatus {
  path: string
  status: string
  output?: string
}

const ncm = {
  getOutputDir: (): Promise<string> => ipcRenderer.invoke('output-dir:get'),
  setOutputDir: (outputDir: string): Promise<void> => ipcRenderer.invoke('output-dir:set', outputDir),
  pickFiles: (): Promise<string[]> => ipcRenderer.invoke('files:pick'),
  pickFolder: (): Promise<string[]> => ipcRenderer.invoke('folder:pick'),
  pickOutputDir: (): Promise<string> => ipcRenderer.invoke('output:pick'),
  collect: (paths: string[]): Promise<string[]> => ipcRenderer.invoke('paths:collect', paths),
  convert: (files: string[], outputDir: string): Promise<void> =>
    ipcRenderer.invoke('convert', files, outputDir),
  onStatus: (listener: (status: ConvertStatus) => void): (() => void) => {
    const channel = 'convert-status'
    const handler = (_event: Electron.IpcRendererEvent, status: ConvertStatus): void => {
      listener(status)
    }
    ipcRenderer.on(channel, handler)
    return () => ipcRenderer.removeListener(channel, handler)
  },
  pathForFile: (file: File): string => webUtils.getPathForFile(file)
}

contextBridge.exposeInMainWorld('ncm', ncm)
