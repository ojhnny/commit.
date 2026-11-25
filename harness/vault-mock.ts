// In-memory stand-in for Obsidian's Vault, FileManager and file classes. No DOM, so tests can use it too.
type Listener = (...args: any[]) => void

export const normalizePath = (p: string) => p.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^\/|\/$/g, '') || '/'

export class Events {
  private l = new Map<string, Set<Listener>>()
  on(name: string, fn: Listener) { if (!this.l.has(name)) this.l.set(name, new Set()); this.l.get(name)!.add(fn); return { name, fn } }
  offref(ref: { name: string; fn: Listener }) { this.l.get(ref.name)?.delete(ref.fn) }
  trigger(name: string, ...a: any[]) { for (const fn of this.l.get(name) ?? []) fn(...a) }
}

export class TAbstractFile {
  vault: MockVault
  path: string
  constructor(vault: MockVault, path: string) { this.vault = vault; this.path = path }
  get name() { return this.path.split('/').pop()! }
  get parent(): TFolder | null {
    const i = this.path.lastIndexOf('/')
    return new TFolder(this.vault, i < 0 ? '/' : this.path.slice(0, i))
  }
}
export class TFile extends TAbstractFile {
  get extension() { return this.name.includes('.') ? this.name.split('.').pop()! : '' }
  get basename() { return this.name.replace(/\.[^.]+$/, '') }
  get stat() { const m = this.vault.meta.get(this.path) ?? { ctime: 0, mtime: 0 }; return { ...m, size: this.vault.files.get(this.path)?.length ?? 0 } }
}
export class TFolder extends TAbstractFile {
  get children(): TAbstractFile[] {
    const prefix = this.path === '/' ? '' : this.path + '/'
    return [...this.vault.files.keys()].filter((k) => k.startsWith(prefix) && !k.slice(prefix.length).includes('/')).map((k) => new TFile(this.vault, k))
  }
}

let clock = Date.now()
const tick = () => (clock = Math.max(clock + 1, Date.now()))

export class MockVault extends Events {
  files = new Map<string, string>()
  meta = new Map<string, { ctime: number; mtime: number }>()
  folders = new Set<string>()
  trashed: string[] = []
  /** Delay before vault events fire, like the real vault's async events. */
  eventDelay = 30

  private fire(name: string, ...args: unknown[]) { setTimeout(() => this.trigger(name, ...args), this.eventDelay) }
  private touch(p: string, created = false) { const t = tick(); this.meta.set(p, { ctime: created ? t : (this.meta.get(p)?.ctime ?? t), mtime: t }) }

  adapter = {
    exists: async (p: string) => this.files.has(p) || this.folders.has(p) || [...this.files.keys()].some((k) => k.startsWith(p + '/')),
    read: async (p: string) => { const t = this.files.get(p); if (t === undefined) throw new Error('ENOENT ' + p); return t },
    write: async (p: string, t: string) => {
      const existed = this.files.has(p)
      this.files.set(p, t)
      this.touch(p, !existed)
      this.fire(existed ? 'modify' : 'create', new TFile(this, p))
    },
    mkdir: async (p: string) => { this.folders.add(p) },
  }

  getAbstractFileByPath(p: string): TAbstractFile | null {
    p = normalizePath(p)
    if (this.files.has(p)) return new TFile(this, p)
    if (this.folders.has(p) || [...this.files.keys()].some((k) => k.startsWith(p + '/'))) return new TFolder(this, p)
    return null
  }
  getMarkdownFiles(): TFile[] { return [...this.files.keys()].filter((k) => k.endsWith('.md')).map((k) => new TFile(this, k)) }
  async cachedRead(f: TFile) { return this.files.get(f.path) ?? '' }
  async read(f: TFile) { return this.files.get(f.path) ?? '' }
  async create(p: string, text: string) {
    if (this.files.has(p)) throw new Error('File already exists.')
    this.files.set(p, text); this.touch(p, true)
    const f = new TFile(this, p); this.fire('create', f); return f
  }
  async modify(f: TFile, text: string) { this.files.set(f.path, text); this.touch(f.path); this.fire('modify', f) }
  async createFolder(p: string) { if (this.folders.has(p)) throw new Error('Folder already exists.'); this.folders.add(p) }
  async trash(f: TAbstractFile, _system: boolean) { this.remove(f) }
  remove(f: TAbstractFile) {
    for (const k of [...this.files.keys()]) if (k === f.path || k.startsWith(f.path + '/')) { this.files.delete(k); this.meta.delete(k); this.trashed.push(k) }
    for (const k of [...this.folders]) if (k === f.path || k.startsWith(f.path + '/')) this.folders.delete(k)
    this.fire('delete', f)
  }
  move(f: TAbstractFile, to: string) {
    const from = f.path
    if (this.getAbstractFileByPath(to)) throw new Error('Destination file already exists!')
    for (const k of [...this.files.keys()]) if (k === from || k.startsWith(from + '/')) {
      const nk = to + k.slice(from.length)
      this.files.set(nk, this.files.get(k)!); this.meta.set(nk, this.meta.get(k)!); this.files.delete(k); this.meta.delete(k)
    }
    for (const k of [...this.folders]) if (k === from || k.startsWith(from + '/')) { this.folders.delete(k); this.folders.add(to + k.slice(from.length)) }
    f.path = to
    this.fire('rename', f, from)
  }
  /** Simulates a change arriving from sync. */
  externalWrite(p: string, t: string) { const existed = this.files.has(p); this.files.set(p, t); this.touch(p, !existed); this.trigger(existed ? 'modify' : 'create', new TFile(this, p)) }
}

export class FileManager {
  vault: MockVault
  constructor(vault: MockVault) { this.vault = vault }
  async renameFile(f: TAbstractFile, to: string) { this.vault.move(f, to) }
  async trashFile(f: TAbstractFile) { this.vault.remove(f) }
}
