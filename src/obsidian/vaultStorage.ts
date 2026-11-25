import { normalizePath, type App, type EventRef, type TAbstractFile } from 'obsidian'
import { STORAGE_KEY, type KeyValueStorage } from '@/services/localStorageRepository'

/**
 * Keeps commit.'s data in one JSON file inside the vault.
 *
 * The repository expects a synchronous key/value store, so the file is read once
 * into memory and every change is written back in the background (in order).
 * Changes made outside the app (Obsidian Sync, iCloud, git, a manual edit) are
 * picked up from the vault's file events and announced to listeners.
 */
export class VaultFileStorage implements KeyValueStorage {
  private cache: string | null = null
  private lastWritten: string | null = null
  private writing: Promise<void> = Promise.resolve()
  private listeners = new Set<() => void>()
  private refs: EventRef[] = []
  private readonly app: App
  path: string

  /** Called when a background write fails, so the plugin can show a notice. */
  onWriteError: (error: unknown) => void = () => undefined

  constructor(app: App, path: string) {
    this.app = app
    this.path = normalizePath(path)
  }

  async init(): Promise<void> {
    this.cache = await this.readFile()
    this.lastWritten = this.cache
    const onFile = (file: TAbstractFile) => {
      if (file.path === this.path) void this.refreshFromDisk()
    }
    this.refs.push(
      this.app.vault.on('modify', onFile),
      this.app.vault.on('create', onFile),
      this.app.vault.on('delete', onFile),
      this.app.vault.on('rename', (file, oldPath) => {
        if (file.path === this.path || oldPath === this.path) void this.refreshFromDisk()
      }),
    )
  }

  /** Points at another file (settings change). Existing data stays where it was. */
  async setPath(path: string): Promise<void> {
    await this.flush()
    this.path = normalizePath(path)
    this.cache = await this.readFile()
    this.lastWritten = this.cache
    this.emit()
  }

  destroy(): void {
    for (const ref of this.refs) this.app.vault.offref(ref)
    this.refs = []
    this.listeners.clear()
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /** Resolves once every queued write has reached the disk. */
  flush(): Promise<void> {
    return this.writing
  }

  // ------------------------------------------------------------ KeyValueStorage

  getItem(key: string): string | null {
    return key === STORAGE_KEY ? this.cache : null
  }

  setItem(key: string, value: string): void {
    if (key !== STORAGE_KEY) return
    this.cache = pretty(value)
    this.queueWrite(this.cache)
  }

  removeItem(key: string): void {
    if (key !== STORAGE_KEY) return
    this.cache = pretty(JSON.stringify({ version: 1, habits: [], logs: [] }))
    this.queueWrite(this.cache)
  }

  // ------------------------------------------------------------ internals

  private emit(): void {
    for (const l of this.listeners) l()
  }

  private queueWrite(text: string): void {
    const path = this.path
    this.writing = this.writing
      .then(async () => {
        const adapter = this.app.vault.adapter
        const folder = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : ''
        if (folder && !(await adapter.exists(folder))) await adapter.mkdir(folder)
        this.lastWritten = text
        await adapter.write(path, text)
      })
      .catch((e) => this.onWriteError(e))
    // Other open commit. views reload from the shared cache.
    queueMicrotask(() => this.emit())
  }

  private async readFile(): Promise<string | null> {
    const adapter = this.app.vault.adapter
    if (!(await adapter.exists(this.path))) return null
    return adapter.read(this.path)
  }

  private async refreshFromDisk(): Promise<void> {
    await this.writing
    const text = await this.readFile()
    // Our own writes come back as modify events; ignore those.
    if (text === this.lastWritten || text === this.cache) return
    this.cache = text
    this.lastWritten = text
    this.emit()
  }
}

function pretty(json: string): string {
  try {
    return `${JSON.stringify(JSON.parse(json), null, 2)}\n`
  } catch {
    return json
  }
}
