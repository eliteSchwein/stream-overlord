<template>
  <v-card color="grey-darken-4">
    <v-card-title class="d-flex align-center justify-space-between">
      <div class="d-flex align-center ga-2">
        <v-btn
          v-if="currentPath"
          icon="mdi-arrow-left"
          variant="text"
          :disabled="loading"
          @click="openParentFolder"
        />

        <div>
          <div>{{ title }}</div>
          <div class="text-caption text-grey-lighten-1">
            /{{ currentPath || '' }}
          </div>
        </div>
      </div>

      <div class="d-flex align-center ga-1">
        <v-btn
          v-if="createFileMethod"
          icon="mdi-file-plus"
          variant="text"
          :disabled="loading || createFileLoading"
          @click="openCreateFileDialog"
        />

        <v-btn
          icon="mdi-folder-plus"
          variant="text"
          :disabled="loading || createFolderLoading"
          @click="openCreateFolderDialog"
        />

        <v-btn
          icon="mdi-refresh"
          variant="text"
          :loading="loading"
          @click="fetchEntries(currentPath)"
        />
      </div>
    </v-card-title>

    <v-card-text>
      <v-row density="compact" class="file-manager-top-row mb-3">
        <v-col cols="12" md="6">
          <StorageCard
            ref="storageCard"
            :hide-assets-used="hideAssetsUsed"
            :hide-overlay-used="hideOverlayUsed"
            :hide-music-used="hideMusicUsed"
          />
        </v-col>

        <v-col cols="12" md="6">
          <UploadCard
            ref="uploadCard"
            :label="uploadLabel"
            :drop-label="dropLabel"
            :icon="uploadIcon"
            :accept="accept"
            :loading="uploading"
            @upload="uploadFiles"
          />
        </v-col>
      </v-row>

      <v-divider class="my-3" />

      <v-text-field
        v-model="searchQuery"
        :label="searchLabel"
        prepend-inner-icon="mdi-magnify"
        clearable
        variant="outlined"
        density="comfortable"
        :disabled="loading && entries.length === 0"
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
        v-if="filteredEntries.length === 0"
        type="info"
        color="grey-darken-3"
        :text="emptyLabel"
      />

      <v-row v-else :key="gridKey" density="comfortable" align="stretch" class="file-manager-grid">
        <v-col
          v-for="item in filteredEntries"
          :key="item.path"
          cols="12"
          sm="6"
          md="4"
          lg="3"
          xl="2"
        >
          <FileCard
            :entry="item"
            :rest-api="getRestApi"
            :public-prefix="publicPrefix"
            :can-compress="canCompress"
            :disabled="isWorking(item.path)"
            :working="workingPath === item.path"
            :working-action="workingAction || ''"
            @open-folder="openFolder"
            @preview="openPreviewDialog"
            @copy="openCopyDialog"
            @compress="compressEntry"
            @move="openMoveDialog"
            @delete="openDeleteDialog"
          />
        </v-col>
      </v-row>
    </v-card-text>

    <FileCreateFolderDialog
      v-model="createFolderDialog"
      :loading="createFolderLoading"
      :error="createFolderError"
      :title="createFolderLabel"
      :folder-label="folderLabel"
      :cancel-label="cancelLabel"
      :submit-label="createFolderLabel"
      @create="createFolder"
    />

    <FileDeleteConfirmDialog
      v-model="deleteDialog"
      :entry="selectedDeleteEntry"
      :rest-api="getRestApi"
      :public-prefix="publicPrefix"
      :loading="workingAction === 'delete'"
      :title="deleteConfirmTitle"
      :text="deleteConfirmText"
      :cancel-label="cancelLabel"
      :delete-label="deleteLabel"
      @confirm="confirmDeleteEntry"
    />

    <FileMoveDialog
      v-model="moveDialog"
      v-model:target="moveTarget"
      :source="moveSource"
      :loading="workingAction === 'move'"
      :list-method="listMethod"
      :create-folder-method="createFolderMethod"
      :title="moveDialogTitle"
      :target-label="targetLabel"
      :target-folder-label="targetFolderLabel"
      :create-folder-label="createFolderLabel"
      :folder-label="folderLabel"
      :folder-up-label="folderUpLabel"
      :no-folders-label="noFoldersLabel"
      :cancel-label="cancelLabel"
      :move-label="moveLabel"
      @move="moveEntry"
      @folder-created="handleMoveDialogFolderCreated"
    />

    <FileCopyDialog
      v-model="copyDialog"
      :entry="selectedCopyEntry"
      :public-prefix="publicPrefix"
      :title="copyDialogTitle"
      :normal-label="normalUrlLabel"
      :compressed-label="compressedUrlLabel"
    />

    <FilePreviewDialog
      v-model="previewDialog"
      :entry="selectedPreviewEntry"
      :rest-api="getRestApi"
      :public-prefix="publicPrefix"
      :can-compress="canCompress"
      :disabled="workingAction !== null"
      :compressing="workingPath === selectedPreviewEntry?.path && workingAction === 'compress'"
      :deleting="workingPath === selectedPreviewEntry?.path && workingAction === 'delete'"
      :title="previewLabel"
      :normal-label="normalUrlLabel"
      :compressed-label="compressedUrlLabel"
      :compress-label="compressLabel"
      :move-label="moveLabel"
      :delete-label="deleteLabel"
      :open-label="openLabel"
      @compress="compressEntry"
      @move="openMoveDialog"
      @delete="openDeleteDialog"
    />

    <CreateFileDialog
      v-model="createFileDialog"
      :current-path="currentPath"
      :websocket-method="createFileMethod"
      :preset-folder="createFilePresetFolder"
      :extension="createFileExtension"
      :enforce-extension="createFileEnforceExtension"
      :no-presets-label="noPresetsLabel"
      :title="createFileLabel"
      :name-label="fileNameLabel"
      :preset-label="templateLabel"
      :cancel-label="cancelLabel"
      :create-label="createFileLabel"
      @created="handleFileCreated"
    />

    <OverlayEditorDialog
      v-if="enableEditor"
      ref="overlayEditorDialog"
      v-model="editorDialog"
      :entry="selectedEditorEntry"
      :read-method="readTextMethod"
      :update-method="updateTextMethod"
      :public-prefix="publicPrefix"
      :title="editorLabel"
      :save-label="saveLabel"
      :code-label="codeLabel"
      :preview-label="previewLabel"
      :width-label="widthLabel"
      :height-label="heightLabel"
      :preset-label="presetLabel"
      :preview-mode-label="previewModeLabel"
      :open-label="openLabel"
      :template-warning-label="templateWarningLabel"
      @saved="handleEditorSaved"
    />
  </v-card>
</template>

<script lang="ts">
import { mapState } from 'pinia'
import { useAppStore } from '@/stores/app'
import eventBus from '@/eventBus'
import StorageCard from '@/components/cards/StorageCard.vue'
import UploadCard from '@/components/cards/UploadCard.vue'
import FileCard from '@/components/files/FileCard.vue'
import FileCopyDialog from '@/components/dialogs/FileCopyDialog.vue'
import FilePreviewDialog from '@/components/dialogs/FilePreviewDialog.vue'
import FileMoveDialog from '@/components/dialogs/FileMoveDialog.vue'
import FileCreateFolderDialog from '@/components/dialogs/FileCreateFolderDialog.vue'
import FileDeleteConfirmDialog from '@/components/dialogs/FileDeleteConfirmDialog.vue'
import CreateFileDialog from '@/components/dialogs/CreateFileDialog.vue'
import OverlayEditorDialog from '@/components/dialogs/OverlayEditorDialog.vue'

type FileEntry = {
  name: string
  path: string
  type: 'file' | 'folder'
  size?: number
  modified?: string
  compressed?: string | null
  asset?: {
    original?: string
    compressed?: string | null
  } | string | null
  [key: string]: any
}

export default {
  name: 'FileManagerPage',

  components: {
    StorageCard,
    UploadCard,
    FileCard,
    FileCopyDialog,
    FilePreviewDialog,
    FileMoveDialog,
    FileCreateFolderDialog,
    FileDeleteConfirmDialog,
    CreateFileDialog,
    OverlayEditorDialog,
  },

  props: {
    title: {
      type: String,
      required: true,
    },
    routeBase: {
      type: String,
      required: true,
    },
    routeParam: {
      type: String,
      required: true,
    },
    listMethod: {
      type: String,
      required: true,
    },
    deleteMethod: {
      type: String,
      required: true,
    },
    moveMethod: {
      type: String,
      required: true,
    },
    createFolderMethod: {
      type: String,
      required: true,
    },
    createFileMethod: {
      type: String,
      default: '',
    },
    createFilePresetFolder: {
      type: String,
      default: 'file',
    },
    createFileExtension: {
      type: String,
      default: 'txt',
    },
    createFileEnforceExtension: {
      type: Boolean,
      default: false,
    },
    readTextMethod: {
      type: String,
      default: '',
    },
    updateTextMethod: {
      type: String,
      default: '',
    },
    enableEditor: {
      type: Boolean,
      default: false,
    },
    compressMethod: {
      type: String,
      default: '',
    },
    uploadEndpoint: {
      type: String,
      required: true,
    },
    publicPrefix: {
      type: String,
      default: '',
    },
    canCompress: {
      type: Boolean,
      default: false,
    },
    accept: {
      type: String,
      default: '',
    },
    uploadLabel: {
      type: String,
      default: 'Upload',
    },
    dropLabel: {
      type: String,
      default: 'Drop files here',
    },
    uploadIcon: {
      type: String,
      default: 'mdi-upload',
    },
    searchLabel: {
      type: String,
      default: 'Search',
    },
    emptyLabel: {
      type: String,
      default: 'No files found',
    },
    createFolderLabel: {
      type: String,
      default: 'Create folder',
    },
    createFileLabel: {
      type: String,
      default: 'Create file',
    },
    fileNameLabel: {
      type: String,
      default: 'File name',
    },
    templateLabel: {
      type: String,
      default: 'Template',
    },
    contentLabel: {
      type: String,
      default: 'Content',
    },
    noPresetsLabel: {
      type: String,
      default: 'No presets found',
    },
    editorLabel: {
      type: String,
      default: 'Editor',
    },
    saveLabel: {
      type: String,
      default: 'Save',
    },
    codeLabel: {
      type: String,
      default: 'Code',
    },
    widthLabel: {
      type: String,
      default: 'Width',
    },
    heightLabel: {
      type: String,
      default: 'Height',
    },
    presetLabel: {
      type: String,
      default: 'Preset',
    },
    previewModeLabel: {
      type: String,
      default: 'Preview mode',
    },
    templateWarningLabel: {
      type: String,
      default: 'Raw preview does not expand template tags.',
    },
    folderLabel: {
      type: String,
      default: 'Folder',
    },
    folderUpLabel: {
      type: String,
      default: 'Folder up',
    },
    noFoldersLabel: {
      type: String,
      default: 'No folders found',
    },
    moveDialogTitle: {
      type: String,
      default: 'Move',
    },
    copyDialogTitle: {
      type: String,
      default: 'Copy URL',
    },
    previewLabel: {
      type: String,
      default: 'Preview',
    },
    deleteConfirmTitle: {
      type: String,
      default: 'Delete?',
    },
    deleteConfirmText: {
      type: String,
      default: 'Do you really want to delete this file?',
    },
    targetLabel: {
      type: String,
      default: 'Target name',
    },
    targetFolderLabel: {
      type: String,
      default: 'Target folder',
    },
    normalUrlLabel: {
      type: String,
      default: 'URL',
    },
    compressedUrlLabel: {
      type: String,
      default: 'Compressed URL',
    },
    compressLabel: {
      type: String,
      default: 'Compress',
    },
    moveLabel: {
      type: String,
      default: 'Move',
    },
    deleteLabel: {
      type: String,
      default: 'Delete',
    },
    cancelLabel: {
      type: String,
      default: 'Cancel',
    },
    openLabel: {
      type: String,
      default: 'Open',
    },
    hideAssetsUsed: {
      type: Boolean,
      default: false,
    },
    hideOverlayUsed: {
      type: Boolean,
      default: false,
    },
    hideMusicUsed: {
      type: Boolean,
      default: false,
    },
  },

  data() {
    return {
      entries: [] as FileEntry[],
      currentPath: '',
      loading: false,
      uploading: false,
      searchQuery: '',
      errorMessage: '',
      requestSequence: 0,
      workingPath: null as string | null,
      workingAction: null as 'delete' | 'move' | 'compress' | null,
      moveDialog: false,
      moveSource: '',
      moveTarget: '',
      copyDialog: false,
      previewDialog: false,
      createFolderDialog: false,
      createFileDialog: false,
      editorDialog: false,
      deleteDialog: false,
      createFolderLoading: false,
      createFileLoading: false,
      createFolderError: '',
      createFileError: '',
      selectedCopyEntry: null as FileEntry | null,
      selectedPreviewEntry: null as FileEntry | null,
      selectedEditorEntry: null as FileEntry | null,
      selectedDeleteEntry: null as FileEntry | null,
      gridKey: 0,
      websocketConnectedHandler: null as null | (() => void),
    }
  },

  computed: {
    ...mapState(useAppStore, ['getRestApi']),

    filteredEntries(): FileEntry[] {
      const query = String(this.searchQuery ?? '').trim().toLowerCase()

      if (!query) return this.entries

      return this.entries.filter((item: FileEntry) => {
        return [
          item.name,
          item.path,
          this.getCompressedPath(item) ?? '',
        ].some(value => String(value).toLowerCase().includes(query))
      })
    },
  },
  mounted() {
    this.currentPath = this.getRoutePath()

    this.websocketConnectedHandler = () => {
      this.reloadPage()
    }

    eventBus.$on?.('websocket:connected', this.websocketConnectedHandler)

    this.fetchEntries(this.currentPath, false)
  },

  beforeUnmount() {
    if (this.websocketConnectedHandler) {
      eventBus.$off?.('websocket:connected', this.websocketConnectedHandler)
    }
  },

  methods: {
    refreshStorageCard() {
      this.$nextTick(() => {
        ;(this.$refs.storageCard as any)?.fetchStorageInfo?.()
      })
    },

    async reloadPage() {
      await this.fetchEntries(this.currentPath)
    },

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

    async fetchEntries(path: string = '', syncRoute = true) {
      const requestSequence = ++this.requestSequence

      this.loading = true
      this.errorMessage = ''

      try {
        const response = await this.requestWebsocket(this.listMethod, {
          path: this.normalizePath(path),
        })
        const data = response?.data ?? response

        if (requestSequence !== this.requestSequence) return

        if (data?.error) {
          this.errorMessage = data.error
          return
        }

        this.currentPath = this.normalizePath(data?.path ?? path)

        if (syncRoute) {
          await this.updateRoute(this.currentPath, true)
        }

        this.entries = Array.isArray(data?.files) ? data.files : []
        this.gridKey += 1
      } catch (error: any) {
        this.errorMessage = error?.message ?? 'loading files failed'
        console.error('loading files failed', error)
      } finally {
        if (requestSequence === this.requestSequence) {
          this.loading = false
          this.refreshStorageCard()
        }
      }
    },

    async uploadFiles(value: File | File[] | null) {
      if (this.uploading) return

      const selectedFiles = Array.isArray(value)
        ? value
        : value
          ? [value]
          : []

      if (selectedFiles.length === 0) return

      this.uploading = true
      this.errorMessage = ''

      try {
        const formData = new FormData()

        formData.append('path', this.currentPath)

        for (const file of selectedFiles) {
          formData.append('files', file, file.name)
        }

        const request = await fetch(`${this.getRestApi}/api/${this.uploadEndpoint}`, {
          method: 'POST',
          body: formData,
        })

        const response = await request.json().catch(() => ({}))
        const responseData = response?.data ?? response
        const responseStatus = response?.status ?? request.status

        if (!request.ok || responseStatus >= 400 || responseData?.error || response?.error) {
          throw new Error(
            responseData?.message ??
            response?.message ??
            response?.error ??
            `upload failed (${responseStatus})`
          )
        }

        ;(this.$refs.uploadCard as any)?.reset()

        await this.fetchEntries(this.currentPath)
      } catch (error: any) {
        this.errorMessage = error?.message ?? 'upload failed'
        console.error('upload failed', error)
      } finally {
        this.uploading = false
      }
    },

    openDeleteDialog(item: FileEntry | null) {
      if (!item?.path || this.workingAction) return

      this.selectedDeleteEntry = item
      this.deleteDialog = true
      this.errorMessage = ''
    },

    async confirmDeleteEntry() {
      await this.deleteEntry(this.selectedDeleteEntry)
    },

    async deleteEntry(item: FileEntry | null) {
      if (!item?.path || this.workingAction) return

      this.workingPath = item.path
      this.workingAction = 'delete'
      this.errorMessage = ''

      try {
        const data = await this.requestWebsocket(this.deleteMethod, {
          path: item.path,
        })

        if (data?.error) throw new Error(data.error)

        this.deleteDialog = false
        this.selectedDeleteEntry = null

        await this.fetchEntries(this.currentPath)
      } catch (error: any) {
        this.errorMessage = error?.message ?? 'delete failed'
        console.error('delete failed', error)
      } finally {
        this.workingPath = null
        this.workingAction = null
      }
    },

    async compressEntry(item: FileEntry | null) {
      if (!this.canCompress || !this.compressMethod || !item?.path || this.workingAction) return

      this.workingPath = item.path
      this.workingAction = 'compress'
      this.errorMessage = ''

      try {
        const data = await this.requestWebsocket(this.compressMethod, {
          path: item.path,
        }, 120_000)

        if (data?.error) throw new Error(data.error)

        await this.fetchEntries(this.currentPath)
      } catch (error: any) {
        this.errorMessage = error?.message ?? 'compress failed'
        console.error('compress failed', error)
      } finally {
        this.workingPath = null
        this.workingAction = null
      }
    },

    openCreateFolderDialog() {
      this.createFolderError = ''
      this.createFolderDialog = true
    },

    openCreateFileDialog() {
      this.createFileError = ''
      this.createFileDialog = true
    },

    async handleFileCreated(createdPath: string) {
      this.createFileDialog = false
      await this.fetchEntries(this.currentPath)

      const normalizedCreatedPath = this.normalizePath(createdPath)
      const createdEntry = this.entries.find((entry: FileEntry) => entry.path === normalizedCreatedPath) ?? {
        name: normalizedCreatedPath.split('/').pop() || normalizedCreatedPath,
        path: normalizedCreatedPath,
        type: 'file',
      }

      if (this.enableEditor && this.isTextEditable(createdEntry)) {
        this.openEditorDialog(createdEntry)
      }
    },

    async createFolder(folderName: string) {
      if (this.createFolderLoading) return

      const name = this.normalizePath(folderName)

      if (!name) {
        this.createFolderError = 'folder name missing'
        return
      }

      this.createFolderLoading = true
      this.createFolderError = ''
      this.errorMessage = ''

      try {
        const data = await this.requestWebsocket(this.createFolderMethod, {
          path: this.currentPath,
          name,
        })

        if (data?.error) throw new Error(data.error)

        this.createFolderDialog = false
        await this.fetchEntries(this.currentPath)
      } catch (error: any) {
        this.createFolderError = error?.message ?? 'create folder failed'
        console.error('create folder failed', error)
      } finally {
        this.createFolderLoading = false
      }
    },

    openMoveDialog(item: FileEntry | null) {
      if (!item?.path) return

      this.moveSource = item.path
      this.moveTarget = item.path
      this.moveDialog = true
      this.errorMessage = ''
    },

    async handleMoveDialogFolderCreated(folderPath: string) {
      const normalizedPath = this.normalizePath(folderPath)
      const parentPath = this.getParentPath(normalizedPath)

      await this.fetchEntries(parentPath || this.currentPath)
    },

    async moveEntry() {
      if (!this.moveSource || !this.moveTarget || this.workingAction) return

      this.workingPath = this.moveSource
      this.workingAction = 'move'
      this.errorMessage = ''

      try {
        const data = await this.requestWebsocket(this.moveMethod, {
          source: this.moveSource,
          target: this.moveTarget,
        })

        if (data?.error) throw new Error(data.error)

        this.moveDialog = false
        await this.fetchEntries(this.currentPath)
      } catch (error: any) {
        this.errorMessage = error?.message ?? 'move failed'
        console.error('move failed', error)
      } finally {
        this.workingPath = null
        this.workingAction = null
      }
    },

    openCopyDialog(item: FileEntry | null) {
      if (!item || item.type !== 'file') return

      this.selectedCopyEntry = item
      this.copyDialog = true
    },

    openPreviewDialog(item: FileEntry | null) {
      if (!item || item.type !== 'file') return

      if (this.enableEditor && this.isTextEditable(item)) {
        this.openEditorDialog(item)
        return
      }

      this.selectedPreviewEntry = item
      this.previewDialog = true
    },

    openEditorDialog(item: FileEntry | null) {
      if (!item || item.type !== 'file') return

      this.selectedEditorEntry = item
      this.editorDialog = true
      this.errorMessage = ''

      this.$nextTick(() => {
        ;(this.$refs.overlayEditorDialog as any)?.open?.(item)
      })
    },

    async handleEditorSaved() {
      await this.fetchEntries(this.currentPath, false)
    },

    isTextEditable(item: FileEntry | null): boolean {
      if (!item?.path) return false

      return /\.(html?|css|js|mjs|cjs|json|svg|txt|md)$/i.test(item.path)
    },

    openFolder(item: FileEntry) {
      if (item.type !== 'folder') return

      this.openPath(item.path)
    },

    openParentFolder() {
      this.openPath(this.getParentPath(this.currentPath))
    },

    async openPath(path: string, replace = false) {
      const normalized = this.normalizePath(path)

      this.currentPath = normalized
      await this.updateRoute(normalized, replace)
      await this.fetchEntries(normalized, false)
    },

    async openRoutePath(path: string) {
      const normalized = this.normalizePath(path)

      if (normalized === this.currentPath) return

      await this.fetchEntries(normalized, false)
    },

    async openRoute(route: any) {
      await this.openRoutePath(this.getRoutePath(route))
    },

    getRoutePath(route: any = this.$route): string {
      const raw = route?.params?.[this.routeParam]

      if (Array.isArray(raw)) {
        return this.normalizePath(raw.map(part => this.decodeRoutePart(String(part))).join('/'))
      }

      if (typeof raw === 'string') {
        return this.normalizePath(raw.split('/').map(part => this.decodeRoutePart(part)).join('/'))
      }

      return this.getPathFromUrl()
    },

    decodeRoutePart(part: string): string {
      try {
        return decodeURIComponent(part)
      } catch {
        return part
      }
    },

    getPathFromUrl(): string {
      const pathname = window.location.pathname
      const marker = `/${this.normalizePath(this.routeBase)}`
      const index = pathname.indexOf(marker)

      if (index === -1) return ''

      const rawPath = pathname
        .slice(index + marker.length)
        .replace(/^\/+/, '')
        .replace(/\/+$/, '')

      if (!rawPath) return ''

      return rawPath
        .split('/')
        .filter(Boolean)
        .map(part => this.decodeRoutePart(part))
        .join('/')
    },

    getRouteTarget(path: string): string {
      const normalized = this.normalizePath(path)
      const encodedPath = normalized
        .split('/')
        .filter(Boolean)
        .map(part => encodeURIComponent(part))
        .join('/')

      return encodedPath ? `/${this.normalizePath(this.routeBase)}/${encodedPath}` : `/${this.normalizePath(this.routeBase)}`
    },

    async updateRoute(path: string, replace = false) {
      const nextPath = this.getRouteTarget(path)

      if (this.$route?.path === nextPath) return

      if (replace) {
        await this.$router.replace({ path: nextPath })
        return
      }

      await this.$router.push({ path: nextPath })
    },

    getParentPath(path: string): string {
      const parts = this.normalizePath(path).split('/').filter(Boolean)
      parts.pop()

      return parts.join('/')
    },

    normalizePath(value: any): string {
      return String(value ?? '')
        .replace(/\\/g, '/')
        .replace(/^\/+/, '')
        .replace(/\/+/g, '/')
        .replace(/\/+$/, '')
    },

    isWorking(path: string): boolean {
      return this.workingPath === path || this.workingAction !== null
    },

    getCompressedPath(item: FileEntry): string | null {
      if (typeof item.compressed === 'string') return this.normalizePath(item.compressed)
      if (typeof item.asset === 'object' && typeof item.asset?.compressed === 'string') return this.normalizePath(item.asset.compressed)

      return null
    },
  },
}
</script>

<style scoped>
.file-manager-grid {
  max-height: calc(100vh - 342px);
  overflow-y: auto;
}

.file-manager-top-row {
  align-items: stretch;
}
</style>
