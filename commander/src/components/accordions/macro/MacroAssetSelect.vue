<template>
  <div>
    <v-autocomplete
      :model-value="modelValue"
      :items="assetOptions"
      :label="label"
      clearable
      hide-details="auto"
      prepend-inner-icon="mdi-palette"
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
          v-if="hasSelectedAsset"
          icon="mdi-pencil"
          size="x-small"
          variant="text"
          :disabled="disabled || loading || saving"
          @mousedown.stop.prevent
          @click.stop.prevent="openEditAsset"
        />
      </template>

      <template #prepend-item>
        <v-list-item prepend-icon="mdi-plus" @click="openCreateAsset">
          <v-list-item-title>{{ createLabel }}</v-list-item-title>
        </v-list-item>
        <v-divider class="my-1" />
      </template>
    </v-autocomplete>

    <AssetEditorDialog
      ref="assetEditorDialog"
      v-model="editorDialog"
      :asset-name="selectedAssetName"
      :asset="selectedAsset"
      :loading="saving"
      :error="editorError"
      :macro-items="macroItems"
      :media-entries="mediaEntries"
      :wled-items="wledItems"
      @save="saveAsset"
    />
  </div>
</template>

<script lang="ts">
import { useAppStore } from '@/stores/app'
import { getWebsocketClient } from '@/plugins/websocketInstance'
import AssetEditorDialog from '@/components/dialogs/AssetEditorDialog.vue'

export default {
  name: 'MacroAssetSelect',

  components: {
    AssetEditorDialog,
  },

  props: {
    modelValue: { type: String, default: '' },
    label: { type: String, default: 'Asset' },
    disabled: { type: Boolean, default: false },
  },

  emits: ['update:modelValue'],

  data() {
    return {
      loading: false,
      saving: false,
      editorDialog: false,
      editorError: '',
      selectedAssetName: '',
      selectedAsset: null as any,
      localAssets: {} as Record<string, any>,
      localWledConfigs: {} as Record<string, any>,
      mediaEntries: [] as any[],
      menuOpen: false,
      hasLoadedAssets: false,
    }
  },

  computed: {
    assetConfigs(): Record<string, any> {
      const appStore = useAppStore()
      const storeAssets = appStore.getAssets

      return storeAssets && !Array.isArray(storeAssets) && Object.keys(storeAssets).length
        ? storeAssets as Record<string, any>
        : this.localAssets
    },

    assetOptions(): string[] {
      const options = Object.keys(this.assetConfigs ?? {})
      const current = String(this.modelValue ?? '').trim()

      if (current && !options.includes(current)) {
        options.unshift(current)
      }

      return options.sort((a, b) => a.localeCompare(b))
    },

    hasSelectedAsset(): boolean {
      return String(this.modelValue ?? '').trim().length > 0
    },

    macroItems(): string[] {
      const appStore = useAppStore()
      return Object.keys(appStore.getMacros ?? {}).sort((a, b) => a.localeCompare(b))
    },

    wledItems(): string[] {
      return Object.keys(this.localWledConfigs ?? {}).sort((a, b) => a.localeCompare(b))
    },

    createLabel(): string {
      return `${this.$t?.('assets.createFile') || 'Add asset'}`
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

    async requestAssetEndpoint(method: string, endpoint: string, params: Record<string, any> = {}, timeout = 8_000): Promise<any> {
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
      if (!open || this.hasLoadedAssets || this.loading) return

      if (Object.keys(this.assetConfigs ?? {}).length) {
        this.hasLoadedAssets = true
        return
      }

      await this.refreshAssets()
    },

    async refreshAssets() {
      this.loading = true

      try {
        const appStore = useAppStore()
        const data = await this.requestAssetEndpoint('assets_list', 'assets/list')

        this.localAssets = data?.assets ?? {}
        this.localWledConfigs = data?.wled ?? {}
        this.hasLoadedAssets = true

        appStore.setAssets(this.localAssets)
        await this.fetchMediaEntries()
      } catch (error) {
        this.localAssets = this.localAssets ?? {}
      } finally {
        this.loading = false
      }
    },

    async fetchMediaEntries(path: string = ''): Promise<any[]> {
      try {
        const data = await this.requestAssetEndpoint('media_list', 'assets/media/list', { path }, 15_000)
        const files = Array.isArray(data?.files) ? data.files : []
        const result: any[] = []

        for (const entry of files) {
          result.push(entry)

          if (entry?.type === 'folder' && entry?.path) {
            result.push(...await this.fetchMediaEntries(entry.path))
          }
        }

        if (!path) this.mediaEntries = result.filter((entry) => entry?.type === 'file')
        return result
      } catch (error) {
        if (!path) this.mediaEntries = []
        return []
      }
    },

    async openCreateAsset() {
      this.selectedAssetName = ''
      this.selectedAsset = null
      this.editorError = ''
      this.editorDialog = true

      await this.$nextTick()
      await (this.$refs.assetEditorDialog as any)?.open?.()
    },

    async openEditAsset() {
      const name = String(this.modelValue ?? '').trim()
      if (!name) return

      this.editorError = ''

      if (!this.assetConfigs?.[name]) {
        await this.refreshAssets()
      }

      this.selectedAssetName = name
      this.selectedAsset = this.assetConfigs?.[name] ?? {}
      this.editorDialog = true

      await this.$nextTick()
      await (this.$refs.assetEditorDialog as any)?.open?.()
    },

    async saveAsset(payload: { name: string; path: string; asset: any }) {
      if (!payload?.name || this.saving) return

      this.saving = true
      this.editorError = ''

      try {
        const data = await this.requestAssetEndpoint('assets_edit', 'assets/edit', {
          path: payload.path || `${payload.name}.yaml`,
          name: payload.name,
          asset: payload.asset,
        })

        if (data?.error) throw new Error(data.error)

        this.editorDialog = false
        this.$emit('update:modelValue', payload.name)
        await this.refreshAssets()
      } catch (error: any) {
        this.editorError = error?.message ?? 'save asset failed'
      } finally {
        this.saving = false
      }
    },
  },
}
</script>
