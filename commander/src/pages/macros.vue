<template>
  <v-card class="overflow-auto mx-auto" max-height="100%" elevation="0" color="transparent" max-width="100%">
    <v-card-title class="d-flex align-center justify-space-between px-3 pt-3">
      <div class="d-flex align-center ga-2 min-width-0">
        <v-icon icon="mdi-code-braces" />
        <div class="min-width-0">
          <div class="text-truncate">{{ $t('macro.title') || 'Macros' }}</div>
          <div class="text-caption text-grey-lighten-1">
            {{ filteredMacros.length }} / {{ macroList.length }}
          </div>
        </div>
      </div>

      <div class="d-flex align-center ga-2">
        <v-btn
          prepend-icon="mdi-plus"
          color="primary"
          variant="tonal"
          @click="createDialog = true"
        >
          {{ $t('macro.createFile') || 'Add macro' }}
        </v-btn>

        <v-btn
          icon="mdi-refresh"
          variant="text"
          :loading="loading"
          @click="refreshMacros"
        />
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
            :label="$t('macro.upload') || 'Upload macro'"
            :drop-label="$t('file.dropFiles') || 'Drop files here'"
            icon="mdi-upload"
            accept=".yaml,.yml"
            :loading="uploading"
            @upload="uploadFiles"
          />
        </v-col>
      </v-row>

      <v-text-field
        v-model="searchQuery"
        :label="$t('macro.search') || 'Search macros'"
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
        v-if="filteredMacros.length === 0"
        type="info"
        color="grey-darken-3"
        :text="$t('macro.noMacrosFound') || 'No macros found'"
      />

      <v-expansion-panels
        v-else
        class="macro-list"
        variant="accordion"
      >
        <Macro
          v-for="item in filteredMacros"
          :key="item.name"
          :macro="item.macro"
          :name="item.name"
          :disabled="workingName === item.name"
          :deleting="workingName === item.name && workingAction === 'delete'"
          @edit="openEditor"
          @delete="openDeleteDialog"
        />
      </v-expansion-panels>
    </v-card-text>

    <MacroEditorDialog
      ref="macroEditorDialog"
      v-model="editorDialog"
      :name="selectedMacroName"
      :macro="selectedMacro"
      :file-path="selectedMacroFile"
      :loading="workingAction === 'save' || workingAction === 'read'"
      @saved="handleEditorSaved"
    />

    <MacroDeleteConfirmDialog
      v-model="deleteDialog"
      :name="selectedDeleteName"
      :macro="selectedDeleteMacro"
      :loading="workingAction === 'delete'"
      @confirm="confirmDeleteMacro"
    />

    <CreateFileDialog
      v-model="createDialog"
      websocket-method="macro_edit"
      preset-folder="@/presets/macros"
      extension="yaml"
      enforce-extension
      icon="mdi-code-braces"
      :title="$t('macro.createFile') || 'Add macro'"
      :name-label="$t('macro.name') || 'Macro name'"
      :create-label="$t('macro.create') || 'Create macro'"
      @created="handleMacroCreated"
    />
  </v-card>
</template>

<script lang="ts">
import { mapState } from 'pinia'
import { useAppStore } from '@/stores/app'
import eventBus from '@/eventBus'
import StorageCard from '@/components/cards/StorageCard.vue'
import UploadCard from '@/components/cards/UploadCard.vue'
import Macro from '@/components/Macro.vue'
import MacroEditorDialog from '@/components/dialogs/MacroEditorDialog.vue'
import MacroDeleteConfirmDialog from '@/components/dialogs/MacroDeleteConfirmDialog.vue'
import CreateFileDialog from '@/components/dialogs/CreateFileDialog.vue'

type MacroEntry = {
  name: string
  macro: any
}

export default {
  name: 'Macros',

  components: {
    StorageCard,
    UploadCard,
    Macro,
    MacroEditorDialog,
    MacroDeleteConfirmDialog,
    CreateFileDialog,
  },

  data() {
    return {
      searchQuery: '',
      loading: false,
      uploading: false,
      errorMessage: '',
      editorDialog: false,
      deleteDialog: false,
      createDialog: false,
      selectedMacroName: '',
      selectedMacro: null as any,
      selectedMacroFile: '',
      selectedDeleteName: '',
      selectedDeleteMacro: null as any,
      workingName: null as string | null,
      workingAction: null as string | null,
    }
  },

  computed: {
    ...mapState(useAppStore, ['getMacros', 'getRestApi']),

    macroList(): MacroEntry[] {
      return Object.entries(this.getMacros ?? {})
        .map(([name, macro]) => ({ name, macro }))
        .sort((a, b) => a.name.localeCompare(b.name))
    },

    filteredMacros(): MacroEntry[] {
      const query = String(this.searchQuery ?? '').trim().toLowerCase()

      if (!query) return this.macroList

      return this.macroList.filter((item) => {
        return (
          item.name.toLowerCase().includes(query) ||
          JSON.stringify(item.macro ?? {}).toLowerCase().includes(query)
        )
      })
    },
  },

  mounted() {
    eventBus.$on('websocket:connected', this.refreshMacros)
    this.refreshMacros()
  },

  beforeUnmount() {
    eventBus.$off('websocket:connected', this.refreshMacros)
  },

  methods: {
    requestWebsocket(method: string, params: Record<string, any> = {}, timeout = 30_000): Promise<any> {
      return new Promise((resolve, reject) => {
        eventBus.$emit('websocket:request', {
          method,
          params,
          timeout,
          resolve,
          reject,
        })
      })
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

    async requestMacroEndpoint(method: string, params: Record<string, any> = {}, timeout = 30_000): Promise<any> {
      const response = await this.requestWebsocket(method, params, timeout)
      const data = this.unwrapWebsocketResponse(response, method)
      return this.assertWebsocketResponse(data, `${method} failed`)
    },

    async refreshMacros() {
      this.loading = true
      this.errorMessage = ''

      try {
        await this.requestMacroEndpoint('macro_list', {})
      } catch (error: any) {
        this.errorMessage = error?.message ?? 'loading macros failed'
      } finally {
        this.loading = false
      }
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

        const response = await fetch(`${this.getRestApi}/api/macro/upload`, {
          method: 'POST',
          body: formData,
        })

        const data = await response.json().catch(() => ({}))

        if (!response.ok || data?.error) {
          throw new Error(data?.error ?? 'macro upload failed')
        }

        await this.refreshMacros()
        await (this.$refs.storageCard as any)?.fetchStorageInfo?.()
      } catch (error: any) {
        this.errorMessage = error?.message ?? 'macro upload failed'
      } finally {
        this.uploading = false
      }
    },

    openEditor(name: string, macro: any) {
      this.selectedMacroName = name
      this.selectedMacro = macro
      this.selectedMacroFile = macro?.file ?? `${name}.yaml`
      this.editorDialog = true
      this.$nextTick(() => {
        ;(this.$refs.macroEditorDialog as any)?.open?.()
      })
    },

    openDeleteDialog(name: string, macro: any) {
      this.selectedDeleteName = name
      this.selectedDeleteMacro = macro
      this.deleteDialog = true
    },

    async confirmDeleteMacro() {
      if (!this.selectedDeleteName || this.workingAction) return

      this.workingName = this.selectedDeleteName
      this.workingAction = 'delete'
      this.errorMessage = ''

      try {
        await this.requestMacroEndpoint('macro_delete', {
          path: this.selectedDeleteMacro?.file ?? undefined,
          name: this.selectedDeleteName,
        })

        this.deleteDialog = false
        this.selectedDeleteName = ''
        this.selectedDeleteMacro = null
        this.selectedMacroFile = ''

        await this.refreshMacros()
        await (this.$refs.storageCard as any)?.fetchStorageInfo?.()
      } catch (error: any) {
        this.errorMessage = error?.message ?? 'delete macro failed'
      } finally {
        this.workingName = null
        this.workingAction = null
      }
    },

    async handleMacroCreated(path: string) {
      const fileName = String(path ?? '').split('/').pop() ?? ''
      const name = fileName.replace(/\.ya?ml$/i, '')

      await this.refreshMacros()
      await (this.$refs.storageCard as any)?.fetchStorageInfo?.()

      if (name) {
        this.openEditor(name, { file: fileName, apis: [], tasks: [] })
      }
    },

    async handleEditorSaved() {
      this.editorDialog = false
      await this.refreshMacros()
      await (this.$refs.storageCard as any)?.fetchStorageInfo?.()
    },
  },
}
</script>

<style scoped lang="scss">

:deep(.macro-list .v-expansion-panel-title) {
  min-height: 56px;
  padding: 0 18px;
}

:deep(.macro-list .v-expansion-panel-title__overlay) {
  display: none;
}

:deep(.macro-list .v-expansion-panel:not(:first-child)::after) {
  border-top: thin solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.min-width-0 {
  min-width: 0;
}
</style>
