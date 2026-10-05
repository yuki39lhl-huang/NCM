import { createDecipheriv } from 'crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { basename, join } from 'path'

const CORE_KEY = Buffer.from('hzHRAmso5kInbaxW', 'ascii')
const KEY_PREFIX = Buffer.from('neteasecloudmusic', 'ascii')

export function convertNcm(ncmFile: string, outputDir: string): string {
  const data = readFileSync(ncmFile)
  const magic = data.subarray(0, 8).toString('ascii')
  if (magic !== 'CTENFDAM') {
    throw new Error('不是有效的 NCM 文件')
  }

  const keyLength = data.readUInt32LE(0x0a)
  const keyOffset = 0x0e
  const metaLengthOffset = keyOffset + keyLength
  const metaLength = data.readUInt32LE(metaLengthOffset)
  const metaOffset = metaLengthOffset + 4

  let cursor = metaOffset + metaLength
  cursor += 4
  cursor += 5
  const imageLength = data.readUInt32LE(cursor)
  cursor += 4
  const imageOffset = cursor
  const audioOffset = imageOffset + imageLength

  const encryptedKey = Buffer.from(data.subarray(keyOffset, keyOffset + keyLength))
  for (let i = 0; i < encryptedKey.length; i++) {
    encryptedKey[i] ^= 0x64
  }

  const keyPlain = aesEcbDecrypt(CORE_KEY, encryptedKey)
  if (!keyPlain.subarray(0, KEY_PREFIX.length).equals(KEY_PREFIX)) {
    throw new Error('密钥明文不是 neteasecloudmusic 开头')
  }
  const musicKey = keyPlain.subarray(KEY_PREFIX.length)

  let audio: Buffer<ArrayBufferLike> = Buffer.from(data.subarray(audioOffset))
  decryptAudio(musicKey, audio)

  const format = detectFormat(audio)
  if (format === 'mp3' && imageLength > 0) {
    const image = data.subarray(imageOffset, imageOffset + imageLength)
    audio = embedJpegCover(audio, image)
  }

  const fileName = basename(ncmFile)
  const dot = fileName.lastIndexOf('.')
  const baseName = dot > 0 ? fileName.slice(0, dot) : fileName
  mkdirSync(outputDir, { recursive: true })
  const output = join(outputDir, `${baseName}.${format}`)
  writeFileSync(output, audio)
  return output
}

function aesEcbDecrypt(key: Buffer, data: Buffer): Buffer {
  const decipher = createDecipheriv('aes-128-ecb', key, null)
  return Buffer.concat([decipher.update(data), decipher.final()])
}

function decryptAudio(key: Buffer, audio: Buffer): void {
  const box = Buffer.alloc(256)
  for (let i = 0; i < 256; i++) {
    box[i] = i
  }

  let j = 0
  for (let i = 0; i < 256; i++) {
    j = (j + box[i] + key[i % key.length]) & 0xff
    const swap = box[i]
    box[i] = box[j]
    box[j] = swap
  }

  for (let i = 0; i < audio.length; i++) {
    const k = (i + 1) & 0xff
    const bk = box[k]
    const idx = (bk + box[(bk + k) & 0xff]) & 0xff
    audio[i] ^= box[idx]
  }
}

function detectFormat(audio: Buffer): string {
  if (audio.length >= 3 && audio[0] === 0x49 && audio[1] === 0x44 && audio[2] === 0x33) {
    return 'mp3'
  }
  if (
    audio.length >= 4 &&
    audio[0] === 0x66 &&
    audio[1] === 0x4c &&
    audio[2] === 0x61 &&
    audio[3] === 0x43
  ) {
    return 'flac'
  }
  if (audio.length >= 2 && audio[0] === 0xff && (audio[1] & 0xe0) === 0xe0) {
    return 'mp3'
  }
  return 'bin'
}

function embedJpegCover(audio: Buffer, jpeg: Buffer): Buffer {
  let oldFrames: Buffer<ArrayBufferLike> = Buffer.alloc(0)
  let audioStart = 0
  let major = 3

  if (audio.length >= 10 && audio[0] === 0x49 && audio[1] === 0x44 && audio[2] === 0x33) {
    major = audio[3]
    const tagSize = readSynchsafe(audio, 6)
    const tagEnd = 10 + tagSize
    oldFrames = readId3Frames(audio, 10, tagEnd, major)
    audioStart = tagEnd
  }

  const apic = buildApicFrame(jpeg, major)
  const body = Buffer.concat([oldFrames, apic])
  const header = Buffer.alloc(10)
  header[0] = 0x49
  header[1] = 0x44
  header[2] = 0x33
  header[3] = major
  writeSynchsafe(header, 6, body.length)
  return Buffer.concat([header, body, audio.subarray(audioStart)])
}

function readId3Frames(audio: Buffer, start: number, end: number, major: number): Buffer {
  const frames: Buffer[] = []
  let pos = start
  while (pos + 10 <= end && audio[pos] !== 0) {
    const frameSize = readFrameSize(audio, pos + 4, major)
    const frameEnd = pos + 10 + frameSize
    if (frameSize < 0 || frameEnd > end) {
      break
    }
    const id = audio.subarray(pos, pos + 4).toString('latin1')
    if (id !== 'APIC') {
      frames.push(audio.subarray(pos, frameEnd))
    }
    pos = frameEnd
  }
  return Buffer.concat(frames)
}

function buildApicFrame(jpeg: Buffer, major: number): Buffer {
  const mime = Buffer.from('image/jpeg\0', 'latin1')
  const bodySize = 1 + mime.length + 1 + 1 + jpeg.length
  const frame = Buffer.alloc(10 + bodySize)
  frame[0] = 0x41
  frame[1] = 0x50
  frame[2] = 0x49
  frame[3] = 0x43
  writeFrameSize(frame, 4, bodySize, major)
  frame[10] = 0
  mime.copy(frame, 11)
  const pictureType = 11 + mime.length
  frame[pictureType] = 3
  frame[pictureType + 1] = 0
  jpeg.copy(frame, pictureType + 2)
  return frame
}

function readSynchsafe(data: Buffer, offset: number): number {
  return (
    ((data[offset] & 0x7f) << 21) |
    ((data[offset + 1] & 0x7f) << 14) |
    ((data[offset + 2] & 0x7f) << 7) |
    (data[offset + 3] & 0x7f)
  )
}

function writeSynchsafe(data: Buffer, offset: number, size: number): void {
  data[offset] = (size >> 21) & 0x7f
  data[offset + 1] = (size >> 14) & 0x7f
  data[offset + 2] = (size >> 7) & 0x7f
  data[offset + 3] = size & 0x7f
}

function readFrameSize(data: Buffer, offset: number, major: number): number {
  if (major >= 4) {
    return readSynchsafe(data, offset)
  }
  return data.readUInt32BE(offset)
}

function writeFrameSize(data: Buffer, offset: number, size: number, major: number): void {
  if (major >= 4) {
    writeSynchsafe(data, offset, size)
    return
  }
  data.writeUInt32BE(size, offset)
}
