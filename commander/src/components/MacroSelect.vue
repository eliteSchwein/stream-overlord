<template>
  <div>
    <v-autocomplete
      :model-value="modelValue"
      :items="macroOptions"
      :label="label"
      clearable
      hide-details="auto"
      prepend-inner-icon="mdi-playlist-play"
      variant="outlined"
      density="comfortable"
      :loading="loading"
      :disabled="disabled"
      v-model:menu="menuOpen"
      @update:menu="handleMenuUpdate"
      @update:model-value="$emit('update:modelValue', $event ?? '')"
    >
      <template #append-inner>
        <v-btn
          v-if="hasSelectedMacro"
          icon="mdi-pencil"
          size="x-small"
          variant="text"
          :disabled="disabled || loading || saving"
          @mousedown.stop.prevent
          @click.stop.prevent="openEditMacro"
        />
      </template>

      <template #prepend-item>
        <v-list-item prepend-icon="mdi-plus" @click="openCreateMacroNameDialog">
          <v-list-item-title>{{ createLabel }}</v-list-item-title>
        </v-list-item>
        <v-divider class="my-1" />
      </template>
    </v-autocomplete>

    <v-dialog v-model="createNameDialog" max-width="520">
      <v-card color="grey-darken-4">
        <v-toolbar flat density="comfortable">
          <v-toolbar-title class="d-flex align-center">
            <v-icon icon="mdi-plus" class="mr-2" />
            Create macro
          </v-toolbar-title>
          <v-btn icon="mdi-close" variant="text" @click="createNameDialog = false" />
        </v-toolbar>

        <v-card-text>
          <v-alert
            v-if="editorError"
            type="error"
            color="red-darken-3"
            density="comfortable"
            class="mb-3"
            :text="editorError"
          />

          <v-text-field
            v-model="newMacroName"
            label="Macro name"
            density="comfortable"
            variant="outlined"
            autofocus
            hide-details="auto"
            @keydown.enter.prevent="createMacroAndOpenEditor"
          />
        </v-card-text>

        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="createNameDialog = false">Cancel</v-btn>
          <v-btn
            color="primary"
            variant="tonal"
            prepend-icon="mdi-plus"
            :loading="saving"
            :disabled="!normalizedNewMacroName"
            @click="createMacroAndOpenEditor"
          >
            Create macro
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <MacroEditorDialog
      ref="macroEditorDialog"
      v-model="editorDialog"
      :name="selectedMacroName"
      @saved="handleMacroSaved"
    />
  </div>
</template>

<script lang="ts">
import { useAppStore } from '@/stores/app'
import { getWebsocketClient } from '@/plugins/websocketInstance'
import MacroEditorDialog from '@/components/dialogs/MacroEditorDialog.vue'

export default {
  name: 'MacroSelect',

  components: {
    MacroEditorDialog,
  },

  props: {
    modelValue: { type: String, default: '' },
    label: { type: String, default: 'Macro' },
    disabled: { type: Boolean, default: false },
  },

  emits: ['update:modelValue', 'saved'],

  data() {
    return {
      loading: false,
      saving: false,
      editorDialog: false,
      createNameDialog: false,
      editorError: '',
      selectedMacroName: '',
      newMacroName: '',
      localMacros: {} as Record<string, any>,
      menuOpen: false,
      hasLoadedMacros: false,
    }
  },

  computed: {
    macroConfigs(): Record<string, any> {
      const appStore = useAppStore()
      const storeMacros = appStore.getMacros

      return storeMacros && !Array.isArray(storeMacros) && Object.keys(storeMacros).length
        ? storeMacros as Record<string, any>
        : this.localMacros
    },

    macroOptions(): string[] {
      const options = Object.keys(this.macroConfigs ?? {})
      const current = String(this.modelValue ?? '').trim()

      if (current && !options.includes(current)) {
        options.unshift(current)
      }

      return options.sort((a, b) => a.localeCompare(b))
    },

    hasSelectedMacro(): boolean {
      return String(this.modelValue ?? '').trim().length > 0
    },

    createLabel(): string {
      return `${this.$t?.('macro.createFile')}`
    },

    normalizedNewMacroName(): string {
      return String(this.newMacroName ?? '').trim()
    },
  },

  methods: {
    async requestWebsocket(method: string, params: Record<string, any> = {}, timeout = 8_000): Promise<any> {
      const client = getWebsocketClient()

      if (!client) {
        throw new Error('websocket is not connected')
      }

      return await client.request(method, params, timeout)
    },

    getWebsocketResultKey(method: string) {
      return `result_${String(method ?? '').replace(/[^a-zA-Z0-9_]/g, '_')}`
    },

    unwrapWebsocketResponse(response: any, method = ''): any {
      const resultKey = method ? this.getWebsocketResultKey(method) : ''
      const containers = [response, response?.params, response?.data, response?.payload, response?.result].filter(Boolean)

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
          if (Object.prototype.hasOwnProperty.call(container, 'params')) return container.params
        }
      }

      return response
    },

    async requestMacroEndpoint(method: string, endpoint: string, params: Record<string, any> = {}, timeout = 8_000): Promise<any> {
      const appStore = useAppStore()

      try {
        const response = await this.requestWebsocket(method, params, timeout)
        const data = this.unwrapWebsocketResponse(response, method)

        if (data?.error) throw new Error(data.error)
        if (data?.success === false) throw new Error(data?.message ?? `${method} failed`)

        return data
      } catch (websocketError) {
        const response = await fetch(`${appStore.getRestApi}/api/${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params),
        })

        const data = await response.json().catch(() => ({}))
        const responseData = data?.data ?? data

        if (!response.ok || responseData?.error || data?.error) {
          throw new Error(responseData?.error ?? data?.error ?? `${endpoint} failed`)
        }

        return responseData
      }
    },

    async handleMenuUpdate(open: boolean) {
      if (!open || this.hasLoadedMacros || this.loading) return

      if (Object.keys(this.macroConfigs ?? {}).length) {
        this.hasLoadedMacros = true
        return
      }

      await this.refreshMacros()
    },

    async refreshMacros() {
      this.loading = true

      try {
        const data = await this.requestMacroEndpoint('macro_list', 'macro/list')
        const files = Array.isArray(data?.files) ? data.files : []
        const macros: Record<string, any> = {}

        for (const file of files) {
          if (file?.type !== 'file') continue
          const name = String(file.name ?? '').replace(/\.(ya?ml|json)$/i, '')
          if (name) macros[name] = { file: file.path }
        }

        this.localMacros = macros
        this.hasLoadedMacros = true
      } catch (error) {
        this.localMacros = this.localMacros ?? {}
      } finally {
        this.loading = false
      }
    },

    openCreateMacroNameDialog() {
      this.menuOpen = false
      this.editorError = ''
      this.newMacroName = ''
      this.createNameDialog = true
    },

    async createMacroAndOpenEditor() {
      const name = this.normalizedNewMacroName
      if (!name || this.saving) return

      this.saving = true
      this.editorError = ''

      try {
        await this.requestMacroEndpoint('macro_edit', 'macro/edit', {
          name,
          content: this.defaultMacroYaml(name),
        })

        this.createNameDialog = false
        this.$emit('update:modelValue', name)
        this.selectedMacroName = name
        await this.refreshMacros()
        await this.openEditorDialog()
      } catch (error: any) {
        this.editorError = error?.message ?? 'create macro failed'
      } finally {
        this.saving = false
      }
    },

    async openEditMacro() {
      const name = String(this.modelValue ?? '').trim()
      if (!name) return

      this.selectedMacroName = name
      await this.openEditorDialog()
    },

    async openEditorDialog() {
      this.editorError = ''
      this.editorDialog = true

      await this.$nextTick()
      await (this.$refs.macroEditorDialog as any)?.open?.()
    },

    async handleMacroSaved() {
      this.editorDialog = false
      this.$emit('update:modelValue', this.selectedMacroName)
      this.$emit('saved', this.selectedMacroName)
      await this.refreshMacros()
    },

    defaultMacroYaml(name: string) {
      return `name: ${this.yamlScalar(name)}\napis: []\ntasks: []\n`
    },

    yamlScalar(value: any) {
      if (value === null || value === undefined) return 'null'
      if (typeof value === 'boolean') return value ? 'true' : 'false'
      if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '0'
      const stringValue = String(value)
      if (!stringValue || /[:#\n\[\]{}]|^\s|\s$/.test(stringValue)) return JSON.stringify(stringValue)
      return stringValue
    },
  },
}
</script>
