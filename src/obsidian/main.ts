import { App, ItemView, Notice, Plugin, PluginSettingTab, Setting, normalizePath, type WorkspaceLeaf } from 'obsidian'
import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { LocalStorageHabitRepository } from '@/services/localStorageRepository'
import type { Platform } from '@/platform/Platform'
import { CommitApp } from './CommitApp'
import { VaultNotes } from './vaultNotes'
import { VaultHabitRepository } from './vaultRepository'
import { VaultFileStorage } from './vaultStorage'

export const VIEW_TYPE = 'commit-habits'

interface CommitSettings {
  dataFile: string
  backupFolder: string
  notesFolder: string
}

const DEFAULT_SETTINGS: CommitSettings = {
  dataFile: 'commit/habits.json',
  backupFolder: 'commit/backups',
  notesFolder: 'commit/notes',
}

export default class CommitPlugin extends Plugin {
  settings: CommitSettings = DEFAULT_SETTINGS
  storage!: VaultFileStorage
  notes!: VaultNotes
  repository!: VaultHabitRepository

  async onload(): Promise<void> {
    this.settings = { ...DEFAULT_SETTINGS, ...((await this.loadData()) as Partial<CommitSettings> | null) }

    this.storage = new VaultFileStorage(this.app, this.settings.dataFile)
    this.storage.onWriteError = (e) => {
      console.error('commit.: could not save', e)
      new Notice(`commit. couldn't save to ${this.storage.path}. Check that the folder exists and is writable.`)
    }
    await this.storage.init()
    this.notes = new VaultNotes(this.app, this.settings.notesFolder)
    // File events only start once the vault has finished loading, so startup doesn't count as changes.
    this.app.workspace.onLayoutReady(() => this.notes.init())
    this.repository = new VaultHabitRepository(new LocalStorageHabitRepository({ storage: this.storage }), this.notes)

    this.registerView(VIEW_TYPE, (leaf) => new CommitView(leaf, this))

    this.addRibbonIcon('calendar-check', 'Open commit.', () => void this.activateView())
    this.addCommand({ id: 'open', name: 'Open habits', callback: () => void this.activateView() })
    this.addCommand({ id: 'open-new-tab', name: 'Open habits in a new tab', callback: () => void this.activateView(true) })
    this.addCommand({ id: 'open-sidebar', name: 'Open habits in the right sidebar', callback: () => void this.activateView(false, true) })

    this.addSettingTab(new CommitSettingTab(this.app, this))
  }

  async onunload(): Promise<void> {
    await this.storage.flush()
    this.storage.destroy()
    this.notes.destroy()
  }

  async activateView(newTab = false, sidebar = false): Promise<void> {
    const { workspace } = this.app
    const existing = workspace.getLeavesOfType(VIEW_TYPE)[0]
    if (existing && !newTab && !sidebar) {
      await workspace.revealLeaf(existing)
      return
    }
    const leaf = sidebar ? workspace.getRightLeaf(false) : workspace.getLeaf(newTab ? 'tab' : false)
    if (!leaf) return
    await leaf.setViewState({ type: VIEW_TYPE, active: true })
    await workspace.revealLeaf(leaf)
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings)
  }

  /** Data file changes and note file changes both refresh open views. */
  subscribe = (onChange: () => void): (() => void) => {
    const a = this.storage.subscribe(onChange)
    const b = this.notes.subscribe(onChange)
    return () => {
      a()
      b()
    }
  }

  async saveBackup(contents: string, fileName: string): Promise<string> {
    const adapter = this.app.vault.adapter
    const folder = normalizePath(this.settings.backupFolder || '/')
    if (folder !== '/' && !(await adapter.exists(folder))) await adapter.mkdir(folder)
    let path = normalizePath(folder === '/' ? fileName : `${folder}/${fileName}`)
    for (let i = 2; await adapter.exists(path); i++) path = path.replace(/(?: \(\d+\))?\.json$/, ` (${i}).json`)
    await adapter.write(path, contents)
    return path
  }
}

class CommitView extends ItemView {
  private root: Root | null = null
  private portal: HTMLElement | null = null
  private readonly plugin: CommitPlugin

  constructor(leaf: WorkspaceLeaf, plugin: CommitPlugin) {
    super(leaf)
    this.plugin = plugin
  }

  getViewType(): string {
    return VIEW_TYPE
  }

  getDisplayText(): string {
    return 'commit.'
  }

  getIcon(): string {
    return 'calendar-check'
  }

  async onOpen(): Promise<void> {
    const el = this.contentEl
    el.empty()
    el.addClass('commit-root', 'commit-view')
    el.tabIndex = -1
    const app = el.createDiv({ cls: 'commit-app' })
    // Overlays live in a full-window layer so they aren't clipped by the pane.
    this.portal = el.doc.body.createDiv({ cls: 'commit-root commit-portal' })

    const platform: Platform = {
      portalContainer: this.portal,
      keyTarget: el,
      storageLabel: this.plugin.storage.path,
      saveBackup: (contents, fileName) => this.plugin.saveBackup(contents, fileName),
      openNote: (note) => void this.plugin.repository.openNote(note.id),
      scrollToTop: () => {
        el.scrollTop = 0
      },
    }

    this.root = createRoot(app)
    this.root.render(
      createElement(CommitApp, {
        repository: this.plugin.repository,
        subscribe: this.plugin.subscribe,
        platform,
      }),
    )
  }

  async onClose(): Promise<void> {
    this.root?.unmount()
    this.root = null
    this.portal?.remove()
    this.portal = null
  }

  /** Re-mounts after the data file setting changes so the footer shows the new path. */
  async refresh(): Promise<void> {
    await this.onClose()
    await this.onOpen()
  }
}

class CommitSettingTab extends PluginSettingTab {
  private readonly plugin: CommitPlugin

  constructor(app: App, plugin: CommitPlugin) {
    super(app, plugin)
    this.plugin = plugin
  }

  display(): void {
    const { containerEl } = this
    containerEl.empty()

    let pendingPath = this.plugin.settings.dataFile
    new Setting(containerEl)
      .setName('Data file')
      .setDesc('Where your habits and logged progress are saved, relative to the vault root. Changing this does not move existing data.')
      .addText((t) =>
        t
          .setPlaceholder(DEFAULT_SETTINGS.dataFile)
          .setValue(this.plugin.settings.dataFile)
          .onChange((v) => {
            pendingPath = v.trim()
          }),
      )
      .addButton((b) =>
        b.setButtonText('Apply').onClick(async () => {
          const path = normalizePath(pendingPath || DEFAULT_SETTINGS.dataFile)
          if (!path.endsWith('.json')) {
            new Notice('The data file must end in .json')
            return
          }
          this.plugin.settings.dataFile = path
          await this.plugin.saveSettings()
          await this.plugin.storage.setPath(path)
          for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
            if (leaf.view instanceof CommitView) await leaf.view.refresh()
          }
          new Notice(`commit. now uses ${path}`)
        }),
      )

    new Setting(containerEl)
      .setName('Notes folder')
      .setDesc("Each habit's notes are Markdown files in a subfolder named after the habit. Applies to habits that don't have notes yet.")
      .addText((t) =>
        t
          .setPlaceholder(DEFAULT_SETTINGS.notesFolder)
          .setValue(this.plugin.settings.notesFolder)
          .onChange(async (v) => {
            this.plugin.settings.notesFolder = normalizePath(v.trim() || DEFAULT_SETTINGS.notesFolder)
            this.plugin.notes.root = this.plugin.settings.notesFolder
            await this.plugin.saveSettings()
          }),
      )

    new Setting(containerEl)
      .setName('Backup folder')
      .setDesc('"Save backup to vault" writes a dated JSON copy here.')
      .addText((t) =>
        t
          .setPlaceholder(DEFAULT_SETTINGS.backupFolder)
          .setValue(this.plugin.settings.backupFolder)
          .onChange(async (v) => {
            this.plugin.settings.backupFolder = v.trim() || DEFAULT_SETTINGS.backupFolder
            await this.plugin.saveSettings()
          }),
      )
  }
}
