<template>
  <v-dialog
    :model-value="modelValue"
    fullscreen
    scrollable
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <v-card color="grey-darken-4" class="auto-macro-editor-dialog">
      <v-toolbar flat density="comfortable">
        <v-toolbar-title class="d-flex align-center min-width-0">
          <v-icon icon="mdi-timer-cog" class="mr-2" />
          <span class="text-truncate">{{ title }}</span>
        </v-toolbar-title>

        <v-switch
          v-model="rawMode"
          color="primary"
          density="comfortable"
          hide-details
          inset
          :label="$t('dialogs.autoMacroEditorDialog.code')"
          class="mr-3"
          @update:model-value="toggleRawMode"
        />

        <YamlImportExportButtons
          class="mr-2"
          :filename="`${visualAutoMacro.name || name || 'auto_macro'}.yaml`"
          :export-content="rawMode ? content : ''"
          :export-data="rawMode ? null : exportAutoMacroData()"
          :disabled="loadingFile || saving"
          @import="importAutoMacroYaml"
          @error="errorMessage = $event?.message ?? 'import failed'"
        />

        <v-btn icon="mdi-refresh" variant="text" :loading="loadingFile" @click="loadAutoMacro" />

        <v-btn
          color="primary"
          variant="tonal"
          prepend-icon="mdi-content-save"
          :loading="saving"
          :disabled="!visualAutoMacro.name || loadingFile || hasVisualErrors"
          @click="saveAutoMacro"
        >
          {{ $t('common.save') || 'Save' }}
        </v-btn>

        <v-btn icon="mdi-close" variant="text" @click="$emit('update:modelValue', false)" />
      </v-toolbar>

      <v-divider />

      <v-card-text class="pa-3">
        <v-alert
          v-if="errorMessage"
          type="error"
          color="red-darken-3"
          density="comfortable"
          class="mb-3"
          :text="errorMessage"
        />

        <div v-if="rawMode" class="auto-macro-editor-dialog__code">
          <vue-monaco-editor
            v-model:value="content"
            language="yaml"
            theme="vs-dark"
            height="520px"
            :options="editorOptions"
          />
        </div>

        <div v-else>
          <v-row density="comfortable">
            <v-col cols="12" md="5">
              <v-text-field
                v-model="visualAutoMacro.name"
                :label="$t('dialogs.autoMacroEditorDialog.name')"
                density="comfortable"
                variant="outlined"
                hide-details
              />
            </v-col>

            <v-col cols="12" sm="6" md="3">
              <v-text-field
                v-model.number="visualAutoMacro.interval"
                :label="$t('dialogs.autoMacroEditorDialog.interval')"
                type="number"
                min="1"
                density="comfortable"
                variant="outlined"
                hide-details
              />
            </v-col>

            <v-col cols="12" sm="6" md="4">
              <v-select
                v-model="intervalUnit"
                :items="intervalUnits"
                item-title="title"
                item-value="value"
                :label="$t('dialogs.autoMacroEditorDialog.unit')"
                density="comfortable"
                variant="outlined"
                hide-details
              />
            </v-col>

            <v-col cols="12" md="6">
              <v-switch
                v-model="visualAutoMacro.default_enabled"
                color="primary"
                :label="$t('dialogs.autoMacroEditorDialog.startEnabledAfterRestart')"
                hide-details
                inset
              />
            </v-col>

            <v-col cols="12">
              <v-card color="grey-darken-3" variant="flat" class="pa-3">
                <div class="d-flex align-center justify-space-between ga-2 mb-3">
                  <div class="d-flex align-center ga-2 min-width-0">
                    <v-icon icon="mdi-format-list-numbered" />
                    <div class="min-width-0">
                      <div class="text-subtitle-2">{{ $t('dialogs.autoMacroEditorDialog.macroOrder') }}</div>
                      <div class="text-caption text-medium-emphasis">
                        Macros are triggered from top to bottom.
                      </div>
                    </div>
                  </div>

                  <v-chip size="small" variant="tonal" class="flex-shrink-0">
                    {{ visualAutoMacro.macros.length }}
                  </v-chip>
                </div>

                <div class="d-flex ga-2 mb-3 auto-macro-editor-dialog__macro-add">
                  <MacroSelect
                    v-model="selectedMacroToAdd"
                    :label="$t('dialogs.autoMacroEditorDialog.addMacro')"
                    class="flex-grow-1"
                    @update:model-value="addSelectedMacro"
                  />
                </div>

                <v-alert
                  v-if="!visualAutoMacro.macros.length"
                  type="info"
                  variant="tonal"
                  density="comfortable"
                  :text="$t('dialogs.autoMacroEditorDialog.noMacrosSelectedYetAddAtLeastOneMacroToTrigger')"
                />

                <v-list v-else bg-color="transparent" density="compact" class="pa-0">
                  <v-list-item
                    v-for="(macro, index) in visualAutoMacro.macros"
                    :key="`${macro}-${index}`"
                    class="auto-macro-editor-dialog__macro-item mb-2"
                    rounded="lg"
                  >
                    <template #prepend>
                      <v-avatar size="28" color="grey-darken-2" class="mr-3">
                        <span class="text-caption">{{ index + 1 }}</span>
                      </v-avatar>
                    </template>

                    <v-list-item-title class="text-body-2 text-truncate">
                      {{ macro }}
                    </v-list-item-title>

                    <template #append>
                      <div class="d-flex align-center ga-1">
                        <v-btn
                          size="small"
                          color="primary"
                          variant="tonal"
                          prepend-icon="mdi-pencil"
                          @click="openMacroEditor(macro)"
                        >
                          Edit
                        </v-btn>

                        <v-btn
                          size="small"
                          variant="tonal"
                          prepend-icon="mdi-arrow-up"
                          :disabled="index === 0"
                          @click="moveMacroUp(index)"
                        >
                          Move up
                        </v-btn>

                        <v-btn
                          size="small"
                          variant="tonal"
                          prepend-icon="mdi-arrow-down"
                          :disabled="index === visualAutoMacro.macros.length - 1"
                          @click="moveMacroDown(index)"
                        >
                          Move down
                        </v-btn>

                        <v-btn
                          size="small"
                          color="error"
                          variant="tonal"
                          prepend-icon="mdi-delete"
                          @click="removeMacro(index)"
                        >
                          Remove
                        </v-btn>
                      </div>
                    </template>
                  </v-list-item>
                </v-list>
              </v-card>
            </v-col>
          </v-row>
        </div>
      </v-card-text>
    </v-card>
  </v-dialog>

  <MacroEditorDialog
    ref="macroEditorDialog"
    v-model="macroEditorOpen"
    :name="editingMacroName"
    @saved="handleMacroSaved"
  />
</template>

<script lang="ts">
import { mapState } from 'pinia'
import { useAppStore } from '@/stores/app'
import { getWebsocketClient } from '@/plugins/websocketInstance'
import { VueMonacoEditor } from '@guolao/vue-monaco-editor'
import YamlImportExportButtons from '@/components/YamlImportExportButtons.vue'
import MacroSelect from '@/components/MacroSelect.vue'
import MacroEditorDialog from '@/components/dialogs/MacroEditorDialog.vue'

type VisualAutoMacro = {
  name: string
  default_enabled: boolean
  interval: number
  macros: string[]
}

export default {
  name: 'AutoMacroEditorDialog',

  components: {
    VueMonacoEditor,
    YamlImportExportButtons,
    MacroSelect,
    MacroEditorDialog,
  },

  props: {
    modelValue: { type: Boolean, default: false },
    name: { type: String, default: '' },
    autoMacro: { type: Object, default: null },
    loading: { type: Boolean, default: false },
    filePath: { type: String, default: '' },
  },

  emits: ['update:modelValue', 'saved'],

  data() {
    return {
      content: '',
      rawMode: false,
      intervalUnit: 'seconds',
      intervalUnits: [
        { title: 'Seconds', value: 'seconds' },
        { title: 'Minutes', value: 'minutes' },
        { title: 'Hours', value: 'hours' },
      ],
      visualAutoMacro: {
        name: '',
        default_enabled: false,
        interval: 10,
        macros: [] as string[],
      } as VisualAutoMacro,
      selectedMacroToAdd: '',
      macroEditorOpen: false,
      editingMacroName: '',
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

  computed: {
    ...mapState(useAppStore, ['getMacros']),

    title(): string {
      return this.name ? `Edit ${this.name}` : 'Create auto macro'
    },

    macroOptions(): string[] {
      return Object.keys(this.getMacros ?? {}).sort((a, b) => a.localeCompare(b))
    },

    intervalSeconds(): number {
      const interval = Number(this.visualAutoMacro.interval || 1)
      if (this.intervalUnit === 'hours') return Math.round(interval * 3600)
      if (this.intervalUnit === 'minutes') return Math.round(interval * 60)
      return Math.round(interval)
    },
  },

  methods: {
    open() {
      return this.loadAutoMacro()
    },

    async requestWebsocket(method: string, params: Record<string, any> = {}, timeout = 30_000): Promise<any> {
      const client = getWebsocketClient()
      if (!client) throw new Error('websocket is not connected')
      const response = await client.request(method, params, timeout)
      return response?.params ?? response
    },

    unwrapResponse(response: any, method = '') {
      const resultKey = method ? `result_${String(method).replace(/[^a-zA-Z0-9_]/g, '_')}` : ''
      const containers = [response, response?.data, response?.payload, response?.result].filter(Boolean)

      if (resultKey) {
        for (const container of containers) {
          if (container && typeof container === 'object' && Object.prototype.hasOwnProperty.call(container, resultKey)) {
            return container[resultKey]
          }
        }
      }

      for (const container of containers) {
        if (container && typeof container === 'object') {
          if (Object.prototype.hasOwnProperty.call(container, 'result')) return container.result
          if (Object.prototype.hasOwnProperty.call(container, 'data')) return container.data
          if (Object.prototype.hasOwnProperty.call(container, 'payload')) return container.payload
        }
      }

      return response
    },

    assertResponse(data: any, fallbackMessage: string) {
      if (data?.error) throw new Error(data.error)
      if (data?.success === false) throw new Error(data?.message ?? fallbackMessage)
      return data
    },

    async requestAutoMacroEndpoint(method: string, params: Record<string, any> = {}, timeout = 30_000) {
      const response = await this.requestWebsocket(method, params, timeout)
      return this.assertResponse(this.unwrapResponse(response, method), `${method} failed`)
    },

    async loadAutoMacro() {
      this.loadingFile = true
      this.errorMessage = ''

      try {
        if (this.name || this.filePath) {
          const data = await this.requestAutoMacroEndpoint('auto_macro_read', {
            name: this.name || undefined,
            path: this.filePath || undefined,
            file: this.filePath || undefined,
          })

          this.content = String(data?.content ?? this.autoMacroToYaml(this.autoMacroToVisual()))
        } else {
          this.content = this.autoMacroToYaml(this.autoMacroToVisual())
        }
      } catch (error: any) {
        this.content = this.autoMacroToYaml(this.autoMacroToVisual())
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

    async saveAutoMacro() {
      if (!this.visualAutoMacro.name) return

      this.saving = true
      this.errorMessage = ''

      try {
        if (!this.rawMode) this.syncVisualToContent()

        const saveName = this.name || this.visualAutoMacro.name
        const data = await this.requestAutoMacroEndpoint('auto_macro_edit', {
          name: saveName,
          path: this.filePath || undefined,
          file: this.filePath || undefined,
          content: this.content,
        })

        this.$emit('saved', data)
      } catch (error: any) {
        this.errorMessage = error?.message ?? 'saving auto macro failed'
      } finally {
        this.saving = false
      }
    },

    autoMacroToVisual(): VisualAutoMacro {
      const item: any = this.autoMacro ?? {}
      const seconds = Number(item.interval ?? 600)
      const normalized = this.secondsToBestUnit(seconds)
      this.intervalUnit = normalized.unit

      return {
        name: String(item.name ?? this.name ?? ''),
        default_enabled: Boolean(item.default_enabled ?? false),
        interval: normalized.value,
        macros: Array.isArray(item.macros) ? [...item.macros] : [],
      }
    },

    secondsToBestUnit(seconds: number) {
      const value = Number.isFinite(seconds) && seconds > 0 ? seconds : 600
      if (value % 3600 === 0) return { value: value / 3600, unit: 'hours' }
      if (value % 60 === 0) return { value: value / 60, unit: 'minutes' }
      return { value, unit: 'seconds' }
    },

    parseContentToVisual() {
      try {
        const parsed: any = this.yamlLoad(this.content) ?? {}
        const seconds = Number(parsed.interval ?? parsed.interval_seconds ?? 600)
        const normalized = this.secondsToBestUnit(seconds)

        this.intervalUnit = normalized.unit
        this.visualAutoMacro = {
          name: String(parsed.name ?? this.name ?? ''),
          default_enabled: Boolean(parsed.default_enabled ?? false),
          interval: normalized.value,
          macros: Array.isArray(parsed.macros) ? parsed.macros.map((macro: any) => String(macro)) : [],
        }

        this.hasVisualErrors = false
      } catch (error: any) {
        this.hasVisualErrors = true
        this.errorMessage = error?.message ?? 'Failed to parse auto macro YAML'
      }
    },

    exportAutoMacroData() {
      return {
        name: this.visualAutoMacro.name,
        default_enabled: this.visualAutoMacro.default_enabled,
        interval: this.intervalSeconds,
        macros: this.visualAutoMacro.macros ?? [],
      }
    },

    importAutoMacroYaml(payload: any) {
      try {
        const imported = this.yamlLoad(String(payload?.content ?? '')) ?? {}
        if (!imported || typeof imported !== 'object' || Array.isArray(imported)) {
          throw new Error('invalid auto macro yaml')
        }

        this.content = this.yamlDump(imported)
        this.parseContentToVisual()
        this.rawMode = false
      } catch (error: any) {
        this.errorMessage = error?.message ?? 'import failed'
      }
    },

    syncVisualToContent() {
      this.content = this.autoMacroToYaml(this.exportAutoMacroData())
    },

    autoMacroToYaml(data: any) {
      return this.yamlDump(data)
    },

    yamlDump(value: any, indent = 0): string {
      const pad = ' '.repeat(indent)

      if (Array.isArray(value)) {
        if (!value.length) return '[]'

        return value.map((item) => {
          if (item && typeof item === 'object') {
            const dumped = this.yamlDump(item, indent + 2)
            return `${pad}-\n${dumped}`
          }
          return `${pad}- ${this.yamlScalar(item)}`
        }).join('\n')
      }

      if (value && typeof value === 'object') {
        return Object.entries(value).map(([key, item]) => {
          if (Array.isArray(item)) {
            if (!item.length) return `${pad}${key}: []`
            return `${pad}${key}:\n${this.yamlDump(item, indent + 2)}`
          }

          if (item && typeof item === 'object') {
            return `${pad}${key}:\n${this.yamlDump(item, indent + 2)}`
          }

          return `${pad}${key}: ${this.yamlScalar(item)}`
        }).join('\n') + '\n'
      }

      return `${pad}${this.yamlScalar(value)}`
    },

    yamlScalar(value: any) {
      if (value === null || value === undefined) return 'null'
      if (typeof value === 'boolean') return value ? 'true' : 'false'
      if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '0'
      const stringValue = String(value)
      if (!stringValue || /[:#\n\[\]{}]|^\s|\s$/.test(stringValue)) return JSON.stringify(stringValue)
      return stringValue
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

    addSelectedMacro(value?: string) {
      const macro = String(value ?? this.selectedMacroToAdd ?? '').trim()
      if (!macro) return

      this.visualAutoMacro.macros = [
        ...(this.visualAutoMacro.macros ?? []),
        macro,
      ]
      this.selectedMacroToAdd = ''
    },

    removeMacro(index: number) {
      this.visualAutoMacro.macros = (this.visualAutoMacro.macros ?? []).filter((_: string, macroIndex: number) => macroIndex !== index)
    },

    moveMacroUp(index: number) {
      this.moveMacro(index, index - 1)
    },

    moveMacroDown(index: number) {
      this.moveMacro(index, index + 1)
    },

    moveMacro(fromIndex: number, toIndex: number) {
      const macros = [...(this.visualAutoMacro.macros ?? [])]

      if (fromIndex < 0 || fromIndex >= macros.length) return
      if (toIndex < 0 || toIndex >= macros.length) return

      const [macro] = macros.splice(fromIndex, 1)
      macros.splice(toIndex, 0, macro)
      this.visualAutoMacro.macros = macros
    },

    async openMacroEditor(macro: string) {
      const macroName = String(macro ?? '').trim()
      if (!macroName) return

      this.editingMacroName = macroName
      this.macroEditorOpen = true

      await this.$nextTick()
      await (this.$refs.macroEditorDialog as any)?.open?.()
    },

    async handleMacroSaved() {
      this.macroEditorOpen = false

      // MacroEditorDialog persists the macro through macro_edit. Refresh the local macro list
      // indirectly by closing the dialog and keeping the selected/order list untouched.
      // The normal macro page uses the same explicit open() call pattern.
    },

    formatDuration(totalSeconds: number) {
      const seconds = Math.max(0, Math.round(Number(totalSeconds) || 0))
      const minutes = Math.floor(seconds / 60)
      const remainingSeconds = seconds % 60
      const hours = Math.floor(minutes / 60)
      const remainingMinutes = minutes % 60

      if (hours > 0) return `${hours}h ${remainingMinutes}m`
      if (minutes > 0) return `${minutes}m ${remainingSeconds}s`
      return `${remainingSeconds}s`
    },
  },
}
</script>

<style scoped lang="scss">
.auto-macro-editor-dialog__code {
  min-height: 520px;
}

.auto-macro-editor-dialog__macro-add {
  align-items: center;
}

.auto-macro-editor-dialog__macro-item {
  background: rgba(255, 255, 255, 0.04);
}

@media (max-width: 700px) {
  .auto-macro-editor-dialog__macro-add {
    flex-direction: column;
    align-items: stretch;
  }
}

.min-width-0 {
  min-width: 0;
}
</style>
