// Tiny stand-in for the Obsidian API, enough to run the real plugin in a browser.
type Listener = (...args: any[]) => void

declare global {
  interface HTMLElement {
    empty(): void
    addClass(...c: string[]): void
    createDiv(o?: { cls?: string }): HTMLDivElement
    doc: Document
  }
}
HTMLElement.prototype.empty = function () { this.replaceChildren() }
HTMLElement.prototype.addClass = function (...c: string[]) { this.classList.add(...c.flatMap((x) => x.split(' '))) }
HTMLElement.prototype.createDiv = function (o?: { cls?: string }) {
  const d = document.createElement('div')
  if (o?.cls) d.className = o.cls
  this.append(d)
  return d
}
Object.defineProperty(HTMLElement.prototype, 'doc', { get() { return this.ownerDocument } })

import { FileManager, MockVault, normalizePath, TAbstractFile, TFile, TFolder } from './vault-mock'
export { normalizePath, TAbstractFile, TFile, TFolder, MockVault }

export class Notice { constructor(msg: string) { console.log('[Notice]', msg); (window as any).__notices.push(msg) } }

export class App {
  vault = new MockVault()
  fileManager = new FileManager(this.vault)
  opened: string[] = []
  workspace = {
    getLeavesOfType: () => [] as any[],
    revealLeaf: async () => {},
    getLeaf: () => ({ openFile: async (f: TFile) => { this.opened.push(f.path); (window as any).__notices.push(`Opened ${f.path}`) } }),
    getRightLeaf: () => null,
    onLayoutReady: (cb: () => void) => cb(),
  }
}

export class Plugin {
  app: App
  data: unknown = null
  constructor(app: App) { this.app = app }
  async loadData() { return this.data }
  async saveData(d: unknown) { this.data = d }
  addRibbonIcon() {}
  addCommand() {}
  addSettingTab() {}
  views = new Map<string, (leaf: WorkspaceLeaf) => ItemView>()
  registerView(type: string, f: (leaf: WorkspaceLeaf) => ItemView) { this.views.set(type, f) }
}

export class WorkspaceLeaf { view: ItemView | null = null }

export class ItemView {
  leaf: WorkspaceLeaf
  containerEl: HTMLElement
  contentEl: HTMLElement
  constructor(leaf: WorkspaceLeaf) {
    this.leaf = leaf
    this.containerEl = document.createElement('div')
    this.containerEl.className = 'workspace-leaf-content'
    this.contentEl = this.containerEl.createDiv({ cls: 'view-content' })
  }
}

export class PluginSettingTab { constructor(_a: App, _p: Plugin) {} containerEl = document.createElement('div') }
export class Setting { constructor(_el: HTMLElement) {} setName() { return this } setDesc() { return this } addText() { return this } addButton() { return this } }
export type EventRef = { name: string; fn: Listener }
