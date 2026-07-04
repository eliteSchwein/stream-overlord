<template>
  <v-card class="overflow-auto mx-auto" max-height="100%" elevation="0" color="transparent" max-width="100%">
    <v-card-title class="d-flex align-center justify-space-between px-3 pt-3">
      <div class="d-flex align-center ga-2 min-width-0">
        <v-icon icon="mdi-timer-cog" />
        <div class="min-width-0">
          <div class="text-truncate">{{ $t('autoMacro.title') }}</div>
        </div>
      </div>

      <div class="d-flex align-center ga-2">
        <v-btn
          prepend-icon="mdi-plus"
          color="primary"
          variant="tonal"
          @click="openCreateEditor"
        >
          {{ $t('autoMacro.create') }}
        </v-btn>
      </div>
    </v-card-title>

    <v-card-text>
      <v-row density="compact" class="mb-3">
        <v-col cols="12" md="6">
          <StorageCard
            ref="storageCard"
            :hide-macro-used="false"
          />
        </v-col>

        <v-col cols="12" md="6">
          <UploadCard
            ref="uploadCard"
            :label="$t('autoMacro.upload') || 'Upload auto macro'"
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
        :label="$t('autoMacro.search') || 'Search auto macros'"
        prepend-inner-icon="mdi-magnify"
        clearable
        variant="outlined"
        density="comfortable"
        hide-details
        class="mb-3"
      />

      <v-alert
        v-if="errorMessage"
        type="error"
        color="red-darken-3"
        class="mb-4"
        :text="errorMessage"
      />

      <v-alert
        v-if="filteredAutoMacros.length === 0"
        type="info"
        color="grey-darken-3"
        :text="$t('autoMacro.noAutoMacrosFound') || 'No auto macros found'"
      />

      <div v-else class="auto-macro-list">
        <AutoMacro
          v-for="item in filteredAutoMacros"
          :key="item.name"
          :auto-macro="item.autoMacro"
          mode="editor"
          @edit="openEditor"
          @delete="openDeleteDialog"
        />
      </div>
    </v-card-text>

    <AutoMacroEditorDialog
      ref="autoMacroEditorDialog"
      v-model="editorDialog"
      :name="selectedAutoMacroName"
      :auto-macro="selectedAutoMacro"
      :file-path="selectedAutoMacroFile"
      :loading="workingAction === 'save' || workingAction === 'read'"
      @saved="handleEditorSaved"
    />

    <AutoMacroDeleteConfirmDialog
      v-model="deleteDialog"
      :name="selectedDeleteName"
      :auto-macro="selectedDeleteAutoMacro"
      :loading="workingAction === 'delete'"
      @confirm="confirmDeleteAutoMacro"
    />
  </v-card>
</template>

<script lang="ts">
import { mapState } from 'pinia'
import { useAppStore } from '@/stores/app'
import { getWebsocketClient } from '@/plugins/websocketInstance'
import StorageCard from '@/components/cards/StorageCard.vue'
import UploadCard from '@/components/cards/UploadCard.vue'
import AutoMacro from '@/components/AutoMacro.vue'
import AutoMacroEditorDialog from '@/components/dialogs/AutoMacroEditorDialog.vue'
import AutoMacroDeleteConfirmDialog from '@/components/dialogs/AutoMacroDeleteConfirmDialog.vue'

type AutoMacroEntry = {
  name: string
  autoMacro: any
}

export default {
  name: 'AutoMacros',

  components: {
    StorageCard,
    UploadCard,
    AutoMacro,
    AutoMacroEditorDialog,
    AutoMacroDeleteConfirmDialog,
  },

  data() {
    return {
      searchQuery: '',
      uploading: false,
      errorMessage: '',
      editorDialog: false,
      deleteDialog: false,
      selectedAutoMacroName: '',
      selectedAutoMacro: null as any,
      selectedAutoMacroFile: '',
      selectedDeleteName: '',
      selectedDeleteAutoMacro: null as any,
      workingName: null as string | null,
      workingAction: null as string | null,
    }
  },

  computed: {
    ...mapState(useAppStore, ['getAutoMacros', 'getRestApi']),

    autoMacroList(): AutoMacroEntry[] {
      const source = this.getAutoMacros ?? []

      if (Array.isArray(source)) {
        return source
          .filter((autoMacro: any) => autoMacro?.name)
          .map((autoMacro: any) => ({ name: String(autoMacro.name), autoMacro }))
          .sort((a, b) => a.name.localeCompare(b.name))
      }

      if (source && typeof source === 'object') {
        return Object.entries(source)
          .map(([name, autoMacro]: [string, any]) => ({
            name: String(autoMacro?.name ?? name),
            autoMacro: { name, ...(autoMacro ?? {}) },
          }))
          .sort((a, b) => a.name.localeCompare(b.name))
      }

      return []
    },

    filteredAutoMacros(): AutoMacroEntry[] {
      const query = String(this.searchQuery ?? '').trim().toLowerCase()

      if (!query) return this.autoMacroList

      return this.autoMacroList.filter((item) => {
        return (
          item.name.toLowerCase().includes(query) ||
          JSON.stringify(item.autoMacro ?? {}).toLowerCase().includes(query)
        )
      })
    },
  },

  methods: {
    async requestWebsocket(method: string, params: Record<string, any> = {}, timeout = 30_000): Promise<any> {
      const client = getWebsocketClient()

      if (!client) {
        throw new Error('websocket is not connected')
      }

      const response = await client.request(method, params, timeout)
      return response?.params ?? response
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

    async requestAutoMacroEndpoint(method: string, params: Record<string, any> = {}, timeout = 30_000): Promise<any> {
      const response = await this.requestWebsocket(method, params, timeout)
      const data = this.unwrapWebsocketResponse(response, method)
      return this.assertWebsocketResponse(data, `${method} failed`)
    },

    async uploadFiles(files: File[] | FileList) {
      const fileList = Array.from(files as any)

      if (fileList.length === 0) return

      this.uploading = true
      this.errorMessage = ''

      try {
        const formData = new FormData()

        fileList.forEach((file) => {
          formData.append('files', file)
        })

        const response = await fetch(`${this.getRestApi}/api/auto_macro/upload`, {
          method: 'POST',
          body: formData,
        })

        const data = await response.json().catch(() => ({}))
        const payload = data?.data ?? data

        if (!response.ok || payload?.error) {
          throw new Error(payload?.message ?? payload?.error ?? 'auto macro upload failed')
        }

        await (this.$refs.storageCard as any)?.fetchStorageInfo?.()
      } catch (error: any) {
        this.errorMessage = error?.message ?? 'auto macro upload failed'
      } finally {
        this.uploading = false
      }
    },

    openCreateEditor() {
      this.selectedAutoMacroName = ''
      this.selectedAutoMacro = {
        name: 'auto_macro',
        enabled: false,
        default_enabled: false,
        interval: 600,
        current_interval: 600,
        macros: [],
      }
      this.selectedAutoMacroFile = ''
      this.editorDialog = true
      this.$nextTick(() => {
        ;(this.$refs.autoMacroEditorDialog as any)?.open?.()
      })
    },

    openEditor(autoMacro: any) {
      const name = String(autoMacro?.name ?? '')

      this.selectedAutoMacroName = name
      this.selectedAutoMacro = autoMacro
      this.selectedAutoMacroFile = autoMacro?.file ?? `${name}.yaml`
      this.editorDialog = true
      this.$nextTick(() => {
        ;(this.$refs.autoMacroEditorDialog as any)?.open?.()
      })
    },

    openDeleteDialog(autoMacro: any) {
      const name = String(autoMacro?.name ?? '')

      this.selectedDeleteName = name
      this.selectedDeleteAutoMacro = autoMacro
      this.deleteDialog = true
    },

    async confirmDeleteAutoMacro() {
      if (!this.selectedDeleteName || this.workingAction) return

      this.workingName = this.selectedDeleteName
      this.workingAction = 'delete'
      this.errorMessage = ''

      try {
        await this.requestAutoMacroEndpoint('auto_macro_delete', {
          path: this.selectedDeleteAutoMacro?.file ?? undefined,
          name: this.selectedDeleteName,
        })

        this.deleteDialog = false
        this.selectedDeleteName = ''
        this.selectedDeleteAutoMacro = null
        this.selectedAutoMacroFile = ''

        await (this.$refs.storageCard as any)?.fetchStorageInfo?.()
      } catch (error: any) {
        this.errorMessage = error?.message ?? 'delete auto macro failed'
      } finally {
        this.workingName = null
        this.workingAction = null
      }
    },

    async handleEditorSaved() {
      this.editorDialog = false
      await (this.$refs.storageCard as any)?.fetchStorageInfo?.()
    },
  },
}
</script>

<style scoped lang="scss">
.auto-macro-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.min-width-0 {
  min-width: 0;
}
</style>
