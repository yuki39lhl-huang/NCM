interface ConvertStatus {
  path: string
  status: string
  output?: string
}

interface NcmApi {
  getOutputDir: () => Promise<string>
  setOutputDir: (outputDir: string) => Promise<void>
  pickFiles: () => Promise<string[]>
  pickFolder: () => Promise<string[]>
  pickOutputDir: () => Promise<string>
  collect: (paths: string[]) => Promise<string[]>
  convert: (files: string[], outputDir: string) => Promise<void>
  onStatus: (listener: (status: ConvertStatus) => void) => () => void
  pathForFile: (file: File) => string
}

declare global {
  interface Window {
    ncm: NcmApi
  }
}

export {}
