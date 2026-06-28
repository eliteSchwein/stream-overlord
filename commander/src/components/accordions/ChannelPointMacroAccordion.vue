<template>
  <div class="channel-point-macro-accordion">
    <v-alert
      v-if="errorMessage"
      type="error"
      color="red-darken-3"
      density="comfortable"
      class="mb-3"
      :text="errorMessage"
    />

    <div class="d-flex align-center justify-space-between ga-3 mb-3">
      <div class="min-width-0">
        <div class="text-caption text-grey-lighten-1">{{ rawMode ? 'Raw YAML editor' : 'Visual macro editor' }}</div>
      </div>

      <div class="d-flex align-center ga-2">
        <YamlImportExportButtons
          :filename="`${name || 'macro'}.yaml`"
          :export-content="rawMode ? content : ''"
          :export-data="rawMode ? null : exportMacroData()"
          :disabled="loadingInternal"
          @import="importMacroYaml"
          @error="errorMessage = $event?.message ?? 'import failed'"
        />

        <v-switch
          v-model="rawMode"
          color="primary"
          density="comfortable"
          hide-details
          inset
          label="Code"
          @update:model-value="toggleRawMode"
        />
      </div>
    </div>

    <v-card color="grey-darken-4" variant="flat" class="channel-point-macro-accordion__card">
      <template v-if="rawMode">
        <vue-monaco-editor
          v-model:value="content"
          language="yaml"
          theme="vs-dark"
          height="360px"
          :options="editorOptions"
        />
      </template>

      <template v-else>
        <div class="pa-3">
          <v-row density="comfortable" class="mb-3">
            <v-col cols="12" md="4"
                   class="d-none">
              <v-text-field
                v-model="visualMacro.name"
                label="Name"
                density="comfortable"
                variant="outlined"
                readonly
                hide-details
              />
            </v-col>

            <v-col cols="12" md="12">
              <v-combobox
                v-model="visualMacro.apis"
                label="APIs"
                density="comfortable"
                variant="outlined"
                hide-details
                multiple
                chips
                closable-chips
              />
            </v-col>
          </v-row>

          <MacroTaskList :items="visualMacro.items" />
        </div>
      </template>
    </v-card>
  </div>
</template>

<script lang="ts">
import { VueMonacoEditor } from '@guolao/vue-monaco-editor'
import MacroTaskList from '@/components/MacroTaskList.vue'
import YamlImportExportButtons from '@/components/YamlImportExportButtons.vue'
import {getWebsocketClient} from "@/plugins/websocketInstance.ts";

type VisualTask = {
  id: string
  type: 'task' | 'condition'
  task: any
  children?: VisualTask[]
  branches?: VisualBranch[]
}

type VisualBranch = {
  id: string
  task: any
  children: VisualTask[]
}

export default {
  name: 'ChannelPointMacroAccordion',

  components: {
    VueMonacoEditor,
    MacroTaskList,
    YamlImportExportButtons,
  },

  props: {
    name: { type: String, default: '' },
    initialContent: { type: String, default: '' },
    disableMacroRead: { type: Boolean, default: false },
  },

  data() {
    return {
      content: '',
      loadedName: '',
      loadingInternal: false,
      rawMode: false,
      errorMessage: '',
      hasVisualErrors: false,
      visualMacro: {
        name: '',
        apis: [] as string[],
        items: [] as VisualTask[],
      },
      editorOptions: {
        automaticLayout: true,
        minimap: { enabled: false },
        tabSize: 2,
        insertSpaces: true,
        wordWrap: 'on',
        scrollBeyondLastLine: false,
      },
    }
  },

  mounted() {
    this.loadMacro()
  },

  beforeUnmount() {
  },

  methods: {
    isTimeoutError(error: any) {
      const message = String(error?.message ?? error ?? '').toLowerCase()
      return message.includes('timeout') || message.includes('timed out') || message.includes('request timed out')
    },

    requestWebsocket(method: string, params: Record<string, any> = {}, timeout = 8_000): Promise<any> {
      return new Promise((resolve, reject) => {
        getWebsocketClient()?.request(method, params, timeout).then(resolve).catch(reject)
      })
    },

    unwrapWebsocketResponse(response: any, keys: string[] = []) {
      const candidates = [
        response?.params,
        response?.data?.params,
        response?.payload?.params,
        response?.result?.params,
        response,
        response?.data,
        response?.payload,
        response?.result,
        response?.data?.result,
        response?.payload?.result,
      ]

      for (const container of candidates) {
        if (!container) continue

        for (const key of keys) {
          if (container?.[key] !== undefined) return container[key]
        }
      }

      for (const container of candidates) {
        if (container !== undefined && container !== null) return container
      }

      return response
    },

    normalizeMacroContent(value: any, fallbackName = this.name): string {
      const unwrapped = this.unwrapWebsocketResponse(value, [
        'result_macro_read',
        'result_macro_get',
      ])

      const raw = unwrapped?.content ?? unwrapped?.macro ?? unwrapped?.data?.content ?? unwrapped

      if (typeof raw === 'string') return raw
      if (raw && typeof raw === 'object') return this.yamlDump(raw)

      return this.defaultMacroContent(fallbackName)
    },

    async readMacro(name = this.name) {
      if (!name || this.disableMacroRead) return ''

      const params = { name }
      const methods = ['macro_read']
      let lastError: any = null

      for (const method of methods) {
        try {
          const response = await this.requestWebsocket(method, params, 8_000)
          const data = this.unwrapWebsocketResponse(response, [
            'result_macro_read',
            'result_macro_get',
          ])

          if (data?.error) throw new Error(data.error)
          return this.normalizeMacroContent(data, name)
        } catch (error: any) {
          lastError = error

          if (this.isTimeoutError(error)) {
            console.warn(`${method} timed out, using local/default macro content`, error)
            return this.initialContent || this.defaultMacroContent(name)
          }
        }
      }

      throw lastError ?? new Error('macro read failed')
    },

    async loadMacro(name = this.name) {
      if (this.loadingInternal) return

      this.loadingInternal = true
      this.errorMessage = ''

      try {
        if (this.initialContent && this.disableMacroRead) {
          this.setContent(this.initialContent, name)
          return
        }

        const content = await this.readMacro(name)
        this.loadedName = name
        this.setContent(content || this.initialContent || this.defaultMacroContent(name), name)
      } catch (error: any) {
        if (this.initialContent) {
          this.setContent(this.initialContent, name)
          return
        }

        this.setContent(this.defaultMacroContent(name), name)
        this.errorMessage = this.isTimeoutError(error) ? '' : (error?.message ?? 'loading macro failed')
      } finally {
        this.loadingInternal = false
      }
    },

    uid() {
      return `${Date.now()}_${Math.random().toString(16).slice(2)}`
    },

    defaultMacroContent(name: string) {
      return `name: ${name}\napis: []\ntasks: []\n`
    },

    setContent(content: string, name = this.name) {
      this.content = content || this.defaultMacroContent(name)
      this.parseContentToVisual(name)
    },

    getContent() {
      if (!this.rawMode) this.syncVisualToContent()
      return this.content
    },

    toggleRawMode(value: boolean) {
      if (value) {
        this.syncVisualToContent()
        return
      }

      this.parseContentToVisual(this.name)
    },

    parseContentToVisual(fallbackName = this.name) {
      try {
        const parsed: any = this.yamlLoad(this.content) ?? {}
        const tasks = Array.isArray(parsed.tasks) ? parsed.tasks : []
        const result = this.parseTaskRange(tasks, 0, [])

        this.visualMacro = {
          name: parsed.name ?? fallbackName,
          apis: Array.isArray(parsed.apis) ? parsed.apis : [],
          items: result.items,
        }

        this.hasVisualErrors = false
        this.errorMessage = ''
      } catch (error: any) {
        this.hasVisualErrors = true
        this.errorMessage = error?.message ?? 'Failed to parse macro YAML'
      }
    },

    parseTaskRange(tasks: any[], startIndex: number, stopMethods: string[]) {
      const items: VisualTask[] = []
      let index = startIndex
      let stopMethod = ''

      while (index < tasks.length) {
        const task = this.cloneTask(tasks[index])
        const method = task?.channel === 'condition' ? task.method : ''

        if (stopMethods.includes(method)) {
          stopMethod = method
          break
        }

        if (task?.channel === 'condition' && task.method === 'if') {
          const childResult = this.parseTaskRange(tasks, index + 1, ['else_if', 'else', 'end_if'])
          const branches: VisualBranch[] = []
          index = childResult.index

          while (index < tasks.length && tasks[index]?.channel === 'condition' && ['else_if', 'else'].includes(tasks[index].method)) {
            const branchTask = this.cloneTask(tasks[index])
            const branchResult = this.parseTaskRange(tasks, index + 1, ['else_if', 'else', 'end_if'])

            branches.push({
              id: this.uid(),
              task: branchTask,
              children: branchResult.items,
            })

            index = branchResult.index
          }

          if (tasks[index]?.channel === 'condition' && tasks[index].method === 'end_if') {
            index++
          }

          items.push({
            id: this.uid(),
            type: 'condition',
            task,
            children: childResult.items,
            branches,
          })

          continue
        }

        items.push({
          id: this.uid(),
          type: 'task',
          task,
        })
        index++
      }

      return { items, index, stopMethod }
    },

    exportMacroData() {
      return {
        name: this.name,
        apis: this.visualMacro.apis ?? [],
        tasks: this.flattenVisualTasks(this.visualMacro.items),
      }
    },

    importMacroYaml(payload: any) {
      try {
        const imported = this.yamlLoad(String(payload?.content ?? '')) ?? {}

        if (!imported || typeof imported !== 'object' || Array.isArray(imported)) {
          throw new Error('invalid macro yaml')
        }

        imported.name = this.name
        this.setContent(this.yamlDump(imported), this.name)
        this.rawMode = false
      } catch (error: any) {
        this.errorMessage = error?.message ?? 'import failed'
      }
    },

    syncVisualToContent() {
      const macro = {
        name: this.name,
        apis: this.visualMacro.apis ?? [],
        tasks: this.flattenVisualTasks(this.visualMacro.items),
      }

      this.content = this.yamlDump(macro)
    },

    flattenVisualTasks(items: VisualTask[]): any[] {
      const tasks: any[] = []

      for (const item of items) {
        if (item.type === 'condition') {
          tasks.push(this.cloneTask(item.task))
          tasks.push(...this.flattenVisualTasks(item.children ?? []))

          for (const branch of item.branches ?? []) {
            tasks.push(this.cloneTask(branch.task))
            tasks.push(...this.flattenVisualTasks(branch.children ?? []))
          }

          tasks.push({ channel: 'condition', method: 'end_if' })
          continue
        }

        tasks.push(this.cloneTask(item.task))
      }

      return tasks
    },

    cloneTask(task: any) {
      return JSON.parse(JSON.stringify(task ?? {}))
    },

    yamlLoad(input: string) {
      const lines = String(input ?? '')
        .replace(/\t/g, '  ')
        .split(/\r?\n/)
        .map((raw) => ({ indent: raw.match(/^ */)?.[0].length ?? 0, text: raw.trim() }))
        .filter((line) => line.text && !line.text.startsWith('#'))

      const parseScalar = (value: string): any => {
        const trimmed = value.trim()
        if (trimmed === '') return ''
        if (trimmed === '[]') return []
        if (trimmed === '{}') return {}
        if (trimmed === 'true') return true
        if (trimmed === 'false') return false
        if (trimmed === 'null') return null
        if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed)

        if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
          try {
            return trimmed.startsWith('"') ? JSON.parse(trimmed) : trimmed.slice(1, -1).replace(/''/g, "'")
          } catch (error) {
            return trimmed.slice(1, -1)
          }
        }

        return trimmed
      }

      const parseBlock = (index: number, indent: number): any => {
        if (lines[index]?.text.startsWith('- ')) return parseArray(index, indent)
        return parseObject(index, indent)
      }

      const setPair = (target: any, pair: string, nextIndex: number, parentIndent: number) => {
        const separatorIndex = pair.indexOf(':')
        if (separatorIndex < 0) return nextIndex

        const key = pair.slice(0, separatorIndex).trim()
        const value = pair.slice(separatorIndex + 1).trim()

        if (value) {
          target[key] = parseScalar(value)
          return nextIndex
        }

        if (nextIndex < lines.length && lines[nextIndex].indent > parentIndent) {
          const child = parseBlock(nextIndex, lines[nextIndex].indent)
          target[key] = child.value
          return child.index
        }

        target[key] = null
        return nextIndex
      }

      const parseObject = (index: number, indent: number): any => {
        const object: Record<string, any> = {}

        while (index < lines.length) {
          const line = lines[index]
          if (line.indent < indent) break
          if (line.indent > indent) {
            index++
            continue
          }
          if (line.text.startsWith('- ')) break

          index = setPair(object, line.text, index + 1, indent)
        }

        return { value: object, index }
      }

      const parseArray = (index: number, indent: number): any => {
        const array: any[] = []

        while (index < lines.length) {
          const line = lines[index]
          if (line.indent < indent) break
          if (line.indent > indent) {
            index++
            continue
          }
          if (!line.text.startsWith('- ')) break

          const rest = line.text.slice(2).trim()
          index++

          if (!rest) {
            if (index < lines.length && lines[index].indent > indent) {
              const child = parseBlock(index, lines[index].indent)
              array.push(child.value)
              index = child.index
            } else {
              array.push(null)
            }
            continue
          }

          if (rest.includes(':') && !rest.startsWith('"') && !rest.startsWith("'")) {
            const object: Record<string, any> = {}
            index = setPair(object, rest, index, indent + 2)

            while (index < lines.length && lines[index].indent > indent) {
              const childLine = lines[index]
              if (childLine.indent < indent + 2) break
              if (childLine.indent > indent + 2) {
                index++
                continue
              }
              if (childLine.text.startsWith('- ')) break
              index = setPair(object, childLine.text, index + 1, childLine.indent)
            }

            array.push(object)
            continue
          }

          array.push(parseScalar(rest))
        }

        return { value: array, index }
      }

      if (!lines.length) return {}
      return parseBlock(0, lines[0].indent).value
    },

    yamlDump(value: any): string {
      const quoteString = (value: string) => {
        if (value === '') return '""'
        if (/^[a-zA-Z0-9_.\/${}!-]+$/.test(value) && !['true', 'false', 'null'].includes(value)) return value
        return JSON.stringify(value)
      }

      const scalar = (value: any) => {
        if (value === null || value === undefined) return 'null'
        if (typeof value === 'number' || typeof value === 'boolean') return String(value)
        return quoteString(String(value))
      }

      const dump = (current: any, indent = 0): string[] => {
        const prefix = ' '.repeat(indent)

        if (Array.isArray(current)) {
          if (current.length === 0) return [`${prefix}[]`]

          return current.flatMap((item) => {
            if (item && typeof item === 'object') {
              const entries = Object.entries(item)
              if (entries.length === 0) return [`${prefix}- {}`]

              const [firstKey, firstValue] = entries[0]
              const lines: string[] = []

              if (firstValue && typeof firstValue === 'object') {
                lines.push(`${prefix}- ${firstKey}:`)
                lines.push(...dump(firstValue, indent + 4))
              } else {
                lines.push(`${prefix}- ${firstKey}: ${scalar(firstValue)}`)
              }

              for (const [key, value] of entries.slice(1)) {
                if (value && typeof value === 'object') {
                  lines.push(`${prefix}  ${key}:`)
                  lines.push(...dump(value, indent + 4))
                } else {
                  lines.push(`${prefix}  ${key}: ${scalar(value)}`)
                }
              }

              return lines
            }

            return [`${prefix}- ${scalar(item)}`]
          })
        }

        if (current && typeof current === 'object') {
          return Object.entries(current).flatMap(([key, item]) => {
            if (item && typeof item === 'object') {
              return [`${prefix}${key}:`, ...dump(item, indent + 2)]
            }

            return [`${prefix}${key}: ${scalar(item)}`]
          })
        }

        return [`${prefix}${scalar(current)}`]
      }

      return `${dump(value).join('\n')}\n`
    },
  },
}
</script>

<style scoped lang="scss">
.channel-point-macro-accordion {
  &__card {
    overflow: hidden;
  }
}
</style>
