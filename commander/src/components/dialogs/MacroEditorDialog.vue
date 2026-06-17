<template>
  <v-dialog
    :model-value="modelValue"
    fullscreen
    scrollable
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <v-card color="grey-darken-4" class="macro-editor-dialog">
      <v-toolbar flat density="comfortable">
        <v-toolbar-title class="d-flex align-center min-width-0">
          <v-icon icon="mdi-pencil" class="mr-2" />
          <span class="text-truncate">{{ name }}</span>
        </v-toolbar-title>

        <v-switch
          v-model="rawMode"
          color="primary"
          density="comfortable"
          hide-details
          inset
          label="Code"
          class="mr-3"
          @update:model-value="toggleRawMode"
        />

        <v-btn icon="mdi-refresh" variant="text" :loading="loadingFile" @click="loadMacro" />

        <v-btn
          color="primary"
          variant="tonal"
          prepend-icon="mdi-content-save"
          :loading="saving"
          :disabled="!name || loadingFile || hasVisualErrors"
          @click="saveMacro"
        >
          {{ $t('common.save') || 'Save' }}
        </v-btn>

        <v-btn icon="mdi-close" variant="text" @click="$emit('update:modelValue', false)" />
      </v-toolbar>

      <v-card-text class="pa-3 macro-editor-dialog__body">
        <v-alert
          v-if="errorMessage"
          type="error"
          color="red-darken-3"
          density="comfortable"
          class="mb-3"
          :text="errorMessage"
        />

        <v-card color="grey-darken-3" variant="flat" class="h-100 d-flex flex-column">
          <v-card-title class="py-2 d-flex align-center justify-space-between">
            <span class="text-subtitle-2">{{ rawMode ? 'Raw YAML editor' : 'Visual macro editor' }}</span>
            <v-chip size="small" variant="tonal">{{ rawMode ? 'yaml' : 'accordion' }}</v-chip>
          </v-card-title>

          <v-divider />

          <div v-if="rawMode" class="macro-editor-dialog__code">
            <vue-monaco-editor
              v-model:value="content"
              language="yaml"
              theme="vs-dark"
              height="100%"
              :options="editorOptions"
            />
          </div>

          <div v-else class="macro-editor-dialog__visual pa-3">
            <v-row density="comfortable" class="mb-3">
              <v-col cols="12" md="4">
                <v-text-field
                  v-model="visualMacro.name"
                  label="Name"
                  density="comfortable"
                  variant="outlined"
                  hide-details
                />
              </v-col>

              <v-col cols="12" md="8">
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
        </v-card>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script lang="ts">
import eventBus from '@/eventBus'
import { VueMonacoEditor } from '@guolao/vue-monaco-editor'
import MacroTaskList from '@/components/MacroTaskList.vue'

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
  name: 'MacroEditorDialog',

  components: {
    VueMonacoEditor,
    MacroTaskList,
  },

  props: {
    modelValue: { type: Boolean, default: false },
    name: { type: String, default: '' },
    macro: { type: Object, default: null },
    loading: { type: Boolean, default: false },
    filePath: { type: String, default: '' },
  },

  emits: ['update:modelValue', 'saved'],

  data() {
    return {
      content: '',
      rawMode: false,
      visualMacro: {
        name: '',
        apis: [] as string[],
        items: [] as VisualTask[],
      },
      loadingFile: false,
      saving: false,
      errorMessage: '',
      hasVisualErrors: false,
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

  watch: {
    modelValue(value: boolean) {
      if (value) this.loadMacro()
    },

    name() {
      if (this.modelValue) this.loadMacro()
    },
  },

  methods: {
    requestWebsocket(method: string, params: Record<string, any> = {}, timeout = 30_000): Promise<any> {
      return new Promise((resolve, reject) => {
        eventBus.$emit('websocket:request', { method, params, timeout, resolve, reject })
      })
    },

    uid() {
      return `${Date.now()}_${Math.random().toString(16).slice(2)}`
    },

    async loadMacro() {
      if (!this.name) return

      this.loadingFile = true
      this.errorMessage = ''

      try {
        const response = await this.requestWebsocket('macro_read', {
          name: this.name,
          path: this.filePath || undefined,
          file: this.filePath || undefined,
        })

        const data = response?.data ?? response
        if (data?.error) throw new Error(data.error)

        this.content = String(data?.content ?? this.macroToYaml(this.name, this.macro))
      } catch (error: any) {
        this.content = this.macroToYaml(this.name, this.macro)
        this.errorMessage = error?.message ?? ''
      } finally {
        this.parseContentToVisual()
        this.loadingFile = false
      }
    },

    toggleRawMode(value: boolean) {
      if (value) {
        this.syncVisualToContent()
        return
      }

      this.parseContentToVisual()
    },

    async saveMacro() {
      if (!this.name) return

      this.saving = true
      this.errorMessage = ''

      try {
        if (!this.rawMode) this.syncVisualToContent()

        const response = await this.requestWebsocket('macro_edit', {
          name: this.name,
          path: this.filePath || undefined,
          file: this.filePath || undefined,
          content: this.content,
        })

        const data = response?.data ?? response
        if (data?.error) throw new Error(data.error)

        this.$emit('saved')
      } catch (error: any) {
        this.errorMessage = error?.message ?? 'saving macro failed'
      } finally {
        this.saving = false
      }
    },

    parseContentToVisual() {
      try {
        const parsed: any = this.yamlLoad(this.content) ?? {}
        const tasks = Array.isArray(parsed.tasks) ? parsed.tasks : []
        const result = this.parseTaskRange(tasks, 0, [])

        this.visualMacro = {
          name: parsed.name ?? this.name,
          apis: Array.isArray(parsed.apis) ? parsed.apis : [],
          items: result.items,
        }

        this.hasVisualErrors = false
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

    syncVisualToContent() {
      const macro = {
        name: this.visualMacro.name || this.name,
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


    yamlLoad(input: string) {
      const lines = String(input ?? '')
        .replace(/\t/g, '  ')
        .split(/\r?\n/)
        .map((raw) => ({
          indent: raw.match(/^ */)?.[0].length ?? 0,
          text: raw.trim(),
        }))
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

      const parseBlock = (index: number, indent: number): any => {
        if (lines[index]?.text.startsWith('- ')) return parseArray(index, indent)
        return parseObject(index, indent)
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
          const entries = Object.entries(current)
          if (entries.length === 0) return [`${prefix}{}`]

          return entries.flatMap(([key, item]) => {
            if (item && typeof item === 'object') {
              if (Array.isArray(item) && item.length === 0) return [`${prefix}${key}: []`]
              const child = dump(item, indent + 2)
              return [`${prefix}${key}:`, ...child]
            }

            return [`${prefix}${key}: ${scalar(item)}`]
          })
        }

        return [`${prefix}${scalar(current)}`]
      }

      return `${dump(value).join('\n')}\n`
    },

    cloneTask(task: any) {
      return JSON.parse(JSON.stringify(task ?? {}))
    },

    macroToYaml(name: string, macro: any): string {
      return this.yamlDump({
        name,
        apis: Array.isArray(macro?.apis) ? macro.apis : [],
        tasks: Array.isArray(macro?.tasks) ? macro.tasks : [],
      })
    },
  },
}
</script>

<style scoped>
.macro-editor-dialog__body {
  height: calc(100vh - 48px);
}

.macro-editor-dialog__code,
.macro-editor-dialog__visual {
  flex: 1 1 auto;
  min-height: 0;
  height: 100%;
}

.macro-editor-dialog__visual {
  overflow: auto;
}
</style>
