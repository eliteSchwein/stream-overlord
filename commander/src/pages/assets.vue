<template>
  <v-card class="overflow-auto mx-auto" max-height="100%" elevation="0" color="transparent" max-width="100%">
    <v-card-title class="d-flex align-center justify-space-between px-3 pt-3">
      <div class="d-flex align-center ga-2 min-width-0">
        <v-icon icon="mdi-palette" />
        <div class="min-width-0">
          <div class="text-truncate">{{ $t('assets.title') }}</div>
        </div>
      </div>

      <div class="d-flex align-center ga-2">
        <v-btn prepend-icon="mdi-plus" color="primary" variant="tonal" @click="openCreateEditor">
          {{ $t('assets.createFile') }}
        </v-btn>
      </div>
    </v-card-title>

    <v-card-text>
      <v-row density="compact" class="mb-3">
        <v-col cols="12" md="6">
          <StorageCard ref="storageCard" :hide-assets-used="false" />
        </v-col>

        <v-col cols="12" md="6">
          <UploadCard
            ref="uploadCard"
            :label="$t('assets.uploadConfig') || 'Upload asset config'"
            :drop-label="$t('file.dropFiles') || 'Drop files here'"
            icon="mdi-upload"
            accept=".yaml,.yml,.json"
            :loading="uploading"
            @upload="uploadFiles"
          />
        </v-col>
      </v-row>

      <v-text-field
        v-model="searchQuery"
        :label="$t('assets.search') || 'Search assets'"
        prepend-inner-icon="mdi-magnify"
        clearable
        variant="outlined"
        density="comfortable"
        hide-details
        class="mb-3"
      />

      <v-alert v-if="errorMessage" type="error" color="red-darken-3" class="mb-4" :text="errorMessage" />
      <v-alert v-if="filteredAssets.length === 0" type="info" color="grey-darken-3" :text="$t('assets.noAssetsFound') || 'No assets found'" />

      <v-expansion-panels v-else class="asset-list" variant="accordion">
        <Asset
          v-for="item in filteredAssets"
          :key="item.name"
          :name="item.name"
          :asset="item.asset"
          :disabled="workingAction !== null"
          :deleting="workingName === item.name && workingAction === 'delete'"
          @edit="openEditor"
          @delete="openDeleteDialog"
        />
      </v-expansion-panels>
    </v-card-text>

    <AssetEditorDialog
      ref="assetEditorDialog"
      v-model="editorDialog"
      :asset-name="selectedAssetName"
      :asset="selectedAsset"
      :loading="workingAction === 'save'"
      :error="editorError"
      :macro-items="macroItems"
      :media-entries="mediaEntries"
      :wled-items="wledItems"
      @save="saveEditor"
    />

    <FileDeleteConfirmDialog
      v-model="deleteDialog"
      :entry="deleteEntry"
      :loading="workingAction === 'delete'"
      :rest-api="getRestApi"
      public-prefix="assets_configs"
      :title="$t('assets.deleteConfirmTitle') || 'Delete asset?'"
      :text="$t('assets.deleteConfirmText') || 'Do you really want to delete this asset config?'"
      :cancel-label="$t('common.cancel') || 'Cancel'"
      :delete-label="$t('common.delete') || 'Delete'"
      @confirm="confirmDeleteAsset"
    />
  </v-card>
</template>

<script lang="ts">
import { mapActions, mapState } from 'pinia'
import { useAppStore } from '@/stores/app'
import { getWebsocketClient } from '@/plugins/websocketInstance'
import StorageCard from '@/components/cards/StorageCard.vue'
import UploadCard from '@/components/cards/UploadCard.vue'
import Asset from '@/components/Asset.vue'
import AssetEditorDialog from '@/components/dialogs/AssetEditorDialog.vue'
import FileDeleteConfirmDialog from '@/components/dialogs/FileDeleteConfirmDialog.vue'

type AssetEntry = {
  name: string
  asset: any
}

export default {
  name: 'Assets',

  components: {
    StorageCard,
    UploadCard,
    Asset,
    AssetEditorDialog,
    FileDeleteConfirmDialog,
  },

  data() {
    return {
      searchQuery: '',
      loading: false,
      uploading: false,
      errorMessage: '',
      editorDialog: false,
      deleteDialog: false,
      editorError: '',
      selectedAssetName: '',
      selectedAsset: null as any,
      selectedDeleteName: '',
      selectedDeleteAsset: null as any,
      workingName: null as string | null,
      workingAction: null as string | null,
      localAssets: {} as Record<string, any>,
      localWledConfigs: {} as Record<string, any>,
      mediaEntries: [] as any[],
    }
  },

  computed: {
    ...mapState(useAppStore, ['getAssets', 'getRestApi', 'getMacros']),

    assetConfigs(): Record<string, any> {
      const storeAssets = this.getAssets?.assets ?? []
      return storeAssets && !Array.isArray(storeAssets) && Object.keys(storeAssets).length
        ? storeAssets as Record<string, any>
        : this.localAssets
    },

    macroItems(): string[] {
      return Object.keys(this.getMacros ?? {}).sort((a, b) => a.localeCompare(b))
    },

    wledItems(): string[] {
      return Object.keys(this.localWledConfigs ?? {}).sort((a, b) => a.localeCompare(b))
    },

    assetList(): AssetEntry[] {
      return Object.entries(this.assetConfigs ?? {})
        .map(([name, asset]) => ({ name, asset }))
        .sort((a, b) => a.name.localeCompare(b.name))
    },

    filteredAssets(): AssetEntry[] {
      const query = String(this.searchQuery ?? '').trim().toLowerCase()
      if (!query) return this.assetList

      return this.assetList.filter((item) => {
        return item.name.toLowerCase().includes(query) || JSON.stringify(item.asset ?? {}).toLowerCase().includes(query)
      })
    },

    deleteEntry(): any {
      if (!this.selectedDeleteName) return null

      const path = this.selectedDeleteAsset?.file ?? `${this.selectedDeleteName}.yaml`

      return {
        name: this.selectedDeleteName,
        path,
        type: 'file',
      }
    },
  },

  methods: {
    ...mapActions(useAppStore, ['setAssets']),

    requestWebsocket(method: string, params: Record<string, any> = {}, timeout = 8_000): Promise<any> {
      const client = getWebsocketClient()

      if (!client) {
        return Promise.reject(new Error('websocket is not connected'))
      }

      return client.request(method, params, timeout)
    },

    getWebsocketResultKey(method: string) {
      return `result_${String(method ?? '').replace(/[^a-zA-Z0-9_]/g, '_')}`
    },

    unwrapWebsocketResponse(response: any, method = ''): any {
      const resultKey = method ? this.getWebsocketResultKey(method) : ''
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

    assertWebsocketResponse(data: any, fallbackMessage: string) {
      if (data?.error) {
        throw new Error(data.error)
      }

      if (data?.success === false) {
        throw new Error(data?.message ?? fallbackMessage)
      }

      return data
    },

    async requestAssetEndpoint(method: string, _endpoint = '', params: Record<string, any> = {}, timeout = 8_000): Promise<any> {
      const response = await this.requestWebsocket(method, params, timeout)
      const data = this.unwrapWebsocketResponse(response, method)
      return this.assertWebsocketResponse(data, `${method} failed`)
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

    async uploadFiles(files: File[] | FileList) {
      const fileList = Array.from(files as any)
      if (fileList.length === 0) return

      this.uploading = true
      this.errorMessage = ''

      try {
        const formData = new FormData()
        fileList.forEach((file) => formData.append('files', file))

        const response = await fetch(`${this.getRestApi}/api/assets/upload`, { method: 'POST', body: formData })
        const data = await response.json().catch(() => ({}))
        const responseData = data?.data ?? data

        if (!response.ok || responseData?.error || data?.error) {
          throw new Error(responseData?.error ?? data?.error ?? 'asset upload failed')
        }

        await this.refreshAssets()
        await (this.$refs.storageCard as any)?.fetchStorageInfo?.()
      } catch (error: any) {
        this.errorMessage = error?.message ?? 'asset upload failed'
      } finally {
        this.uploading = false
      }
    },

    async openCreateEditor() {
      this.selectedAssetName = ''
      this.selectedAsset = null
      this.editorError = ''
      this.editorDialog = true
      await this.$nextTick()
      await (this.$refs.assetEditorDialog as any)?.open?.()
    },

    async openEditor(name: string, asset: any) {
      this.selectedAssetName = name
      this.selectedAsset = asset
      this.editorError = ''
      this.editorDialog = true
      await this.$nextTick()
      await (this.$refs.assetEditorDialog as any)?.open?.()
    },

    async saveEditor(payload: { name: string; path: string; asset: any }) {
      if (!payload?.name || this.workingAction) return

      this.workingName = payload.name
      this.workingAction = 'save'
      this.editorError = ''

      try {
        const data = await this.requestAssetEndpoint('assets_edit', 'assets/edit', {
          path: payload.path || `${payload.name}.yaml`,
          name: payload.name,
          asset: payload.asset,
        })

        if (data?.error) throw new Error(data.error)

        this.editorDialog = false
        await this.refreshAssets()
        await (this.$refs.storageCard as any)?.fetchStorageInfo?.()
      } catch (error: any) {
        this.editorError = error?.message ?? 'save asset failed'
      } finally {
        this.workingName = null
        this.workingAction = null
      }
    },

    openDeleteDialog(name: string, asset: any) {
      this.selectedDeleteName = name
      this.selectedDeleteAsset = asset
      this.deleteDialog = true
    },

    async confirmDeleteAsset() {
      if (!this.selectedDeleteName || this.workingAction) return

      this.workingName = this.selectedDeleteName
      this.workingAction = 'delete'
      this.errorMessage = ''

      try {
        const data = await this.requestAssetEndpoint('assets_delete', 'assets/delete', {
          path: this.selectedDeleteAsset?.file ?? undefined,
          name: this.selectedDeleteName,
        })
        if (data?.error) throw new Error(data.error)

        this.deleteDialog = false
        this.selectedDeleteName = ''
        this.selectedDeleteAsset = null
        await this.refreshAssets()
        await (this.$refs.storageCard as any)?.fetchStorageInfo?.()
      } catch (error: any) {
        this.errorMessage = error?.message ?? 'delete asset failed'
      } finally {
        this.workingName = null
        this.workingAction = null
      }
    },
  },
}
</script>

<style scoped lang="scss">
:deep(.asset-list .v-expansion-panel-title) {
  min-height: 56px;
  padding: 0 18px;
}

:deep(.asset-list .v-expansion-panel-title__overlay) {
  display: none;
}

:deep(.asset-list .v-expansion-panel:not(:first-child)::after) {
  border-top: thin solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.min-width-0 {
  min-width: 0;
}
</style>
