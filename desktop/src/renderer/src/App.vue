<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

interface FileItem {
  path: string
  name: string
  status: string
}

const files = ref<FileItem[]>([])
const outputDir = ref('')
const running = ref(false)
const doneCount = ref(0)
const showNotice = ref(false)
const dragging = ref(false)

const canStart = computed(() => !running.value && files.value.length > 0 && outputDir.value.trim() !== '')
const progress = computed(() => (files.value.length === 0 ? 0 : (doneCount.value / files.value.length) * 100))

let stopStatus = (): void => {}

onMounted(async () => {
  outputDir.value = await window.ncm.getOutputDir()
  stopStatus = window.ncm.onStatus((update) => {
    const item = files.value.find((file) => file.path === update.path)
    if (item) {
      item.status = update.status
    }
    if (update.status !== '转换中') {
      doneCount.value += 1
    }
    if (doneCount.value >= files.value.length) {
      running.value = false
    }
  })
})

onUnmounted(() => stopStatus())

function addPaths(paths: string[]): void {
  for (const path of paths) {
    if (files.value.some((file) => file.path === path)) {
      continue
    }
    const name = path.split(/[/\\]/).pop() ?? path
    files.value.push({ path, name, status: '等待' })
  }
}

async function addFiles(): Promise<void> {
  addPaths(await window.ncm.pickFiles())
}

async function addFolder(): Promise<void> {
  addPaths(await window.ncm.pickFolder())
}

function removeFile(path: string): void {
  files.value = files.value.filter((file) => file.path !== path)
}

function clearFiles(): void {
  files.value = []
}

async function browseOutput(): Promise<void> {
  const selected = await window.ncm.pickOutputDir()
  if (selected) {
    outputDir.value = selected
  }
}

async function onOutputBlur(): Promise<void> {
  await window.ncm.setOutputDir(outputDir.value.trim())
}

function onDragOver(): void {
  dragging.value = true
}

function onDragLeave(event: DragEvent): void {
  const next = event.relatedTarget
  const current = event.currentTarget
  if (next instanceof Node && current instanceof Node && current.contains(next)) {
    return
  }
  dragging.value = false
}

async function onDrop(event: DragEvent): Promise<void> {
  dragging.value = false
  const dropped = event.dataTransfer?.files
  if (!dropped || dropped.length === 0) {
    return
  }
  const paths = Array.from(dropped).map((file) => window.ncm.pathForFile(file))
  addPaths(await window.ncm.collect(paths))
}

function requestConvert(): void {
  if (!canStart.value) {
    return
  }
  showNotice.value = true
}

function cancelConvert(): void {
  showNotice.value = false
}

async function confirmConvert(): Promise<void> {
  showNotice.value = false
  await startConvert()
}

async function startConvert(): Promise<void> {
  if (!canStart.value) {
    return
  }
  running.value = true
  doneCount.value = 0
  for (const file of files.value) {
    file.status = '等待'
  }
  await window.ncm.setOutputDir(outputDir.value.trim())
  await window.ncm.convert(
    files.value.map((file) => file.path),
    outputDir.value.trim()
  )
  running.value = false
}

function statusClass(status: string): string {
  if (status.startsWith('失败')) {
    return 'failed'
  }
  if (status === '完成') {
    return 'done'
  }
  if (status === '转换中') {
    return 'active'
  }
  return ''
}
</script>

<template>
  <main class="app" @dragover.prevent="onDragOver" @dragleave="onDragLeave" @drop.prevent="onDrop">
    <header class="toolbar">
      <button class="primary" :disabled="running" @click="addFiles">
        <svg class="icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.5v11M2.5 8h11" /></svg>
        添加文件
      </button>
      <button :disabled="running" @click="addFolder">
        <svg class="icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.5v11M2.5 8h11" /></svg>
        添加文件夹
      </button>
      <button :disabled="running" @click="clearFiles">
        <svg class="icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 4.5h9M6.2 4.5V3.2h3.6v1.3M5.2 4.5l.6 8.3h4.4l.6-8.3" /></svg>
        清空
      </button>
    </header>

    <p class="hint">把 .ncm 拖到窗口里，或使用上方按钮添加</p>

    <section class="drop" :class="{ over: dragging }">
      <ul v-if="files.length" class="files">
        <li v-for="file in files" :key="file.path">
          <span class="name">{{ file.name }}</span>
          <span class="status" :class="statusClass(file.status)">{{ file.status }}</span>
          <button class="remove" :disabled="running" @click="removeFile(file.path)">移除</button>
        </li>
      </ul>
      <div v-else class="empty">
        <svg class="empty-icon" viewBox="0 0 160 160" aria-hidden="true">
          <circle cx="80" cy="80" r="64" />
          <circle cx="80" cy="80" r="48" />
          <circle class="dot" cx="80" cy="12" r="2.2" />
          <circle class="dot" cx="132" cy="46" r="2" />
          <circle class="dot" cx="28" cy="58" r="1.6" />
          <circle class="dot" cx="118" cy="112" r="1.5" />
          <path class="cloud" d="M48 84c0-9 8-16 17-14 3-11 14-17 24-13 8 3 13 11 13 19 9 1 16 8 16 16 0 9-8 16-17 16H62c-9 0-16-6-16-15 0-5 2-8 2-9z" />
          <circle class="note-head" cx="72" cy="88" r="6" />
          <path class="note" d="M78 88V62c8 4 14 8 12 16" />
        </svg>
        <p class="empty-title">拖入 .ncm 文件开始转换</p>
        <p class="empty-sub">支持网易云音乐的 ncm 格式文件</p>
      </div>
    </section>

    <section class="output">
      <label>
        <svg class="icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M2.2 5.2h3.6l1.3 1.4h6.7V12H2.2V5.2z" /></svg>
        输出目录
      </label>
      <div class="dir-row">
        <input v-model="outputDir" :disabled="running" spellcheck="false" @change="onOutputBlur" />
        <button :disabled="running" @click="browseOutput">
          <svg class="icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M2.2 5.2h3.6l1.3 1.4h6.7V12H2.2V5.2z" /></svg>
          浏览
        </button>
      </div>
      <div class="progress"><span :style="{ width: (running ? progress : 100) + '%' }"></span></div>
      <button class="start primary" :disabled="!canStart" @click="requestConvert">
        <svg class="icon play" viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3.2v9.6l8-4.8-8-4.8z" /></svg>
        开始转换
      </button>
    </section>

    <div v-if="showNotice" class="notice-mask" @click.self="cancelConvert" @keydown.esc="cancelConvert">
      <section class="notice" role="dialog" aria-modal="true" aria-labelledby="notice-title">
        <h2 id="notice-title">转换前请确认</h2>
        <p>本工具与网易云音乐无关，只在你的电脑上解析你自己提供的 NCM 文件。</p>
        <p>我们不对解析、转换结果、版权以及之后的使用承担任何责任。请只转换你有权使用的文件。</p>
        <p>继续即表示你已知晓，并自行承担责任。</p>
        <div class="notice-actions">
          <button @click="cancelConvert">取消</button>
          <button class="primary" @click="confirmConvert">继续转换</button>
        </div>
      </section>
    </div>
  </main>
</template>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 18px 20px 16px;
  gap: 12px;
  background:
    radial-gradient(90% 42% at 50% -8%, rgba(160, 24, 40, 0.35), transparent 60%),
    #121212;
}

.toolbar {
  display: flex;
  gap: 10px;
}

.toolbar button {
  height: 36px;
  padding: 0 16px;
  background: #2a2a2a;
}

.toolbar button.primary {
  background: #ec3b48;
}

.toolbar button.primary:hover:not(:disabled) {
  background: #d63636;
}

.icon {
  width: 15px;
  height: 15px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.icon.play {
  fill: currentColor;
  stroke: none;
}

.hint {
  margin: 0;
  color: #8d8d8d;
  font-size: 13px;
}

.drop {
  flex: 1;
  min-height: 0;
  display: flex;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 18px;
  overflow: auto;
  align-items: center;
  justify-content: center;
  background:
    radial-gradient(circle at 50% 46%, rgba(196, 32, 48, 0.28), transparent 34%),
    linear-gradient(180deg, #1a1214 0%, #141214 100%);
}

.drop.over {
  border-color: rgba(236, 59, 72, 0.8);
}

.empty {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.empty-icon {
  width: 132px;
  height: 132px;
  margin-bottom: 8px;
}

.empty-icon circle {
  fill: none;
  stroke: rgba(236, 65, 65, 0.35);
  stroke-width: 1;
}

.empty-icon .dot {
  fill: #ec4141;
  stroke: none;
}

.empty-icon .cloud,
.empty-icon .note,
.empty-icon .note-head {
  fill: none;
  stroke: #ff4d5c;
  stroke-width: 2.4;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.empty-title {
  margin: 0;
  color: #e8e8e8;
  font-size: 16px;
}

.empty-sub {
  margin: 0;
  color: #7a7a7a;
  font-size: 13px;
}

.files {
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 8px;
  list-style: none;
  align-self: stretch;
}

.files li {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 12px;
  align-items: center;
  min-height: 40px;
  padding: 0 12px;
  border-radius: 10px;
}

.files li:hover {
  background: rgba(255, 255, 255, 0.06);
}

.name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status.failed,
.status.done {
  color: #ec4141;
}

.status.active {
  color: #ffffff;
}

.remove {
  height: 28px;
  padding: 0 12px;
  background: #333333;
}

.output {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.output label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #ffffff;
}

.dir-row {
  display: flex;
  gap: 10px;
}

.dir-row input {
  flex: 1;
  height: 40px;
  border: 1px solid #333333;
  border-radius: 999px;
  background: #1a1a1a;
  padding: 0 16px;
}

.dir-row button {
  height: 40px;
  padding: 0 16px;
  background: #2a2a2a;
}

.progress {
  height: 4px;
  margin-top: 4px;
  background: #3a2224;
  border-radius: 999px;
  overflow: hidden;
}

.progress span {
  display: block;
  height: 100%;
  background: #ec4141;
}

.start {
  width: 100%;
  height: 46px;
  background: linear-gradient(180deg, #ff4d5c 0%, #ec3144 100%);
  font-size: 15px;
}

.start:hover:not(:disabled) {
  background: linear-gradient(180deg, #ff5d6a 0%, #d62c3d 100%);
}

.start:disabled {
  opacity: 1;
  background: linear-gradient(180deg, #ff4d5c 0%, #ec3144 100%);
}

.notice-mask {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(0, 0, 0, 0.62);
}

.notice {
  width: min(420px, 100%);
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 20px;
  border-radius: 16px;
  background: #252525;
}

.notice h2 {
  margin: 0;
  font-size: 16px;
}

.notice p {
  margin: 0;
  line-height: 1.6;
  color: #d0d0d0;
}

.notice-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.notice-actions .primary {
  width: auto;
  height: auto;
}
</style>
