import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { BaseTool } from '@starlink/shared'
import type { ToolRegistry } from './registry.js'

const TOOL_DIRS = ['data-source', 'llm-agent', 'analysis', 'output', 'control-flow']

/**
 * Scan tools/ subdirectories and auto-register all *.tool.ts files.
 */
export async function loadAllTools(registry: ToolRegistry): Promise<void> {
  const baseDir = join(fileURLToPath(import.meta.url), '..', '..', 'tools')

  for (const dir of TOOL_DIRS) {
    const dirPath = join(baseDir, dir)
    let files: string[]
    try {
      files = await readdir(dirPath)
    } catch {
      // Directory may not exist yet during development
      continue
    }

    const toolFiles = files.filter((f) => f.endsWith('.tool.js') || f.endsWith('.tool.ts'))

    for (const file of toolFiles) {
      try {
        const modulePath = join(dirPath, file)
        const mod = (await import(modulePath)) as { default: new () => BaseTool }
        if (mod.default) {
          const tool = new mod.default()
          registry.register(tool)
        }
      } catch (err) {
        console.warn(`[tool-loader] Failed to load tool ${dir}/${file}:`, err)
      }
    }
  }

  console.log(`[tool-loader] Loaded ${registry.size} tools`)
}
