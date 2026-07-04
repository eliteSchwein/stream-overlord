<template>
  <div>
    <v-select
      :model-value="modelValue"
      :items="autoMacroOptions"
      :label="label"
      clearable
      hide-details="auto"
      prepend-inner-icon="mdi-playlist-star"
      variant="outlined"
      density="comfortable"
      :loading="loading"
      :disabled="disabled"
      v-model:menu="menuOpen"
      @update:menu="handleMenuUpdate"
      @update:model-value="$emit('update:modelValue', $event ?? '')"
    >
      <template #prepend-item>
        <v-list-item prepend-icon="mdi-plus" @click="openCreateAutoMacro">
          <v-list-item-title>{{ createLabel }}</v-list-item-title>
        </v-list-item>
        <v-divider class="my-1" />
      </template>
    </v-select>

    <AutoMacroCreateDialog
      ref="autoMacroEditorDialog"
      v-model="editorDialog"
      :auto-macro="newAutoMacro"
      @saved="handleAutoMacroSaved"
    />
  </div>
</template>

<script lang="ts">
import { defineAsyncComponent } from 'vue'
import { mapState } from 'pinia'
import { useAppStore } from '@/stores/app'
import { getWebsocketClient } from '@/plugins/websocketInstance'

type AutoMacroOption = {
  title: string
  value: string
  autoMacro?: any
}

export default {
  name: 'AutoMacroSelect',

  components: {
    AutoMacroCreateDialog: defineAsyncComponent(() => import('@/components/dialogs/AutoMacroEditorDialog.vue')),
  },

  props: {
    modelValue: { type: String, default: '' },
    label: { type: String, default: 'Auto macro' },
    disabled: { type: Boolean, default: false },
  },

  emits: ['update:modelValue', 'saved'],

  data() {
    return {
      loading: false,
      menuOpen: false,
      hasLoadedAutoMacros: false,
      localAutoMacros: [] as AutoMacroOption[],
      editorDialog: false,
      newAutoMacro: {
        name: 'auto_macro',
        default_enabled: false,
        interval: 10,
        macros: [] as string[],
      } as any,
    }
  },

  computed: {
    ...mapState(useAppStore, ['getAutoMacros']),

    createLabel(): string {
      return 'Create auto macro'
    },

    autoMacroOptions(): AutoMacroOption[] {
      const source = (this as any).getAutoMacros ?? []
      const options = new Map<string, AutoMacroOption>()

      const addOption = (name: string, autoMacro: any = {}) => {
        const normalizedName = String(name ?? '').trim()
        if (!normalizedName) return
        options.set(normalizedName, {
          title: normalizedName,
          value: normalizedName,
          autoMacro: { name: normalizedName, ...(autoMacro ?? {}) },
        })
      }

      if (Array.isArray(source)) {
        source.forEach((autoMacro: any) => addOption(autoMacro?.name, autoMacro))
      } else if (source && typeof source === 'object') {
        Object.entries(source).forEach(([key, autoMacro]: [string, any]) => {
          addOption(String(autoMacro?.name ?? key), { name: key, ...(autoMacro ?? {}) })
        })
      }

      for (const option of this.localAutoMacros) {
        if (!options.has(option.value)) options.set(option.value, option)
      }

      const current = String(this.modelValue ?? '').trim()
      if (current && !options.has(current)) {
        options.set(current, { title: current, value: current, autoMacro: { name: current } })
      }

      return Array.from(options.values()).sort((a, b) => a.title.localeCompare(b.title))
    },
  },

  methods: {
    async requestWebsocket(method: string, params: Record<string, any> = {}, timeout = 30_000): Promise<any> {
      const client = getWebsocketClient()
      if (!client) throw new Error('websocket is not connected')
      const response = await client.request(method, params, timeout)
      return response?.params ?? response
    },

    unwrapResponse(response: any, method = ''): any {
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

    async requestAutoMacroEndpoint(method: string, params: Record<string, any> = {}, timeout = 30_000): Promise<any> {
      const response = await this.requestWebsocket(method, params, timeout)
      const data = this.unwrapResponse(response, method)
      if (data?.error) throw new Error(data.error)
      if (data?.success === false) throw new Error(data?.message ?? `${method} failed`)
      return data
    },

    async handleMenuUpdate(open: boolean) {
      if (!open || this.hasLoadedAutoMacros || this.loading) return

      if (this.autoMacroOptions.length) {
        this.hasLoadedAutoMacros = true
        return
      }

      await this.refreshAutoMacros()
    },

    openCreateAutoMacro() {
      this.menuOpen = false
      this.newAutoMacro = {
        name: 'auto_macro',
        default_enabled: false,
        interval: 10,
        macros: [],
      }
      this.editorDialog = true
      this.$nextTick(() => (this.$refs.autoMacroEditorDialog as any)?.open?.())
    },

    async handleAutoMacroSaved(data: any) {
      const editor = this.$refs.autoMacroEditorDialog as any
      const name = String(
        editor?.visualAutoMacro?.name ??
        data?.name ??
        data?.autoMacro?.name ??
        data?.auto_macro?.name ??
        ''
      ).trim()

      if (name) {
        const option = { title: name, value: name, autoMacro: { name } }
        const existingIndex = this.localAutoMacros.findIndex((item) => item.value === name)
        if (existingIndex >= 0) this.localAutoMacros.splice(existingIndex, 1, option)
        else this.localAutoMacros.push(option)
        this.$emit('update:modelValue', name)
      }

      this.$emit('saved', name || data)
      this.editorDialog = false
      this.hasLoadedAutoMacros = false
      await this.refreshAutoMacros()
    },

    async refreshAutoMacros() {
      this.loading = true

      try {
        const data = await this.requestAutoMacroEndpoint('auto_macro_list')
        const files = Array.isArray(data?.files) ? data.files : []

        this.localAutoMacros = files
          .filter((file: any) => file?.type === 'file')
          .map((file: any) => {
            const name = String(file?.name ?? file?.path ?? '').replace(/\.(ya?ml|json)$/i, '')
            return {
              title: name,
              value: name,
              autoMacro: { name, file: String(file?.path ?? `${name}.yaml`) },
            }
          })
          .filter((item: AutoMacroOption) => item.value)
          .sort((a: AutoMacroOption, b: AutoMacroOption) => a.title.localeCompare(b.title))

        this.hasLoadedAutoMacros = true
      } catch (error) {
        console.warn(error)
      } finally {
        this.loading = false
      }
    },
  },
}
</script>
