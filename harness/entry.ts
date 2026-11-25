import { App, WorkspaceLeaf } from 'obsidian'
import CommitPlugin, { VIEW_TYPE } from '@/obsidian/main'
;(window as any).__notices = []

async function main() {
  const app = new App()
  const params = new URLSearchParams(location.search)
  if (params.get('seed')) app.vault.files.set('commit/habits.json', await (await fetch(params.get('seed')!)).text())
  const plugin = new (CommitPlugin as any)(app) as CommitPlugin
  await plugin.onload()
  const host = document.getElementById('pane')!
  const make = (plugin as any).views.get(VIEW_TYPE)
  const view = make(new WorkspaceLeaf())
  host.append(view.containerEl)
  await view.onOpen()
  Object.assign(window, { __app: app, __plugin: plugin, __view: view })
}
void main()
