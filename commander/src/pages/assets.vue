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
          <div>{{ $t('assets.title') }}</div>
          <div class="text-caption text-grey-lighten-1">
            /{{ currentPath || '' }}
          </div>
        </div>
      </div>

      <div class="d-flex align-center ga-1">
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
          @click="fetchAssets(currentPath)"
        />
      </div>
    </v-card-title>

    <v-card-text>
      <v-row density="compact" class="assets-top-row mb-3">
        <v-col cols="12" md="6">
          <v-card
            v-if="storageInfo"
            color="grey-darken-3"
            variant="flat"
            class="assets-storage-card h-100"
          >
            <v-card-text class="pa-3">
              <div class="d-flex align-center justify-space-between mb-1">
                <div class="min-width-0">
                  <div class="text-subtitle-2">{{ $t('assets.storage') }}</div>
                </div>
              </div>

              <v-progress-linear
                :model-value="storageUsedPercent"
                height="7"
                rounded
                class="mb-2"
              />

              <div class="assets-storage-info assets-storage-info--compact">
                <div>
                  <span class="text-caption text-grey-lighten-1">{{ $t('assets.storageUsed') }}</span>
                  <span>{{ formatFileSize(storageInfo.used) }}</span>
                </div>
                <div>
                  <span class="text-caption text-grey-lighten-1">{{ $t('assets.storageFree') }}</span>
                  <span>{{ formatFileSize(storageInfo.free) }}</span>
                </div>
                <div>
                  <span class="text-caption text-grey-lighten-1">{{ $t('assets.storageTotal') }}</span>
                  <span>{{ formatFileSize(storageInfo.total) }}</span>
                </div>
                <div>
                  <span class="text-caption text-grey-lighten-1">{{ $t('assets.assetsUsed') }}</span>
                  <span>{{ formatFileSize(storageInfo.assetUsed) }}</span>
                </div>
              </div>
            </v-card-text>
          </v-card>
        </v-col>

        <v-col cols="12" md="6">
          <v-card
            color="grey-darken-3"
            variant="flat"
            class="assets-upload-card h-100"
          >
            <v-card-text class="pa-3 d-flex align-center h-100">
              <v-file-input
                :key="fileInputKey"
                v-model="uploadFiles"
                :label="$t('assets.upload')"
                prepend-icon="mdi-upload"
                multiple
                variant="outlined"
                density="compact"
                hide-details
                class="assets-upload-input"
                :disabled="uploading"
                :loading="uploading"
                @update:model-value="uploadAssetFiles"
              />
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <v-divider class="my-3" />

      <v-text-field
        v-model="searchQuery"
        :label="$t('assets.search')"
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
        :text="$t('assets.noAssetsFound')"
      />

      <v-row v-else :key="assetsGridKey" density="comfortable" align="stretch" class="assets-grid">
        <v-col
          v-for="item in filteredEntries"
          :key="item.path"
          cols="12"
          sm="6"
          md="4"
          lg="3"
          xl="2"
        >
          <v-card
            color="grey-darken-3"
            class="assets-grid-card h-100 d-flex flex-column"
            :class="{ 'assets-grid-card--folder': item.type === 'folder' }"
            @click="item.type === 'folder' ? openFolder(item) : undefined"
          >
            <div
              class="assets-preview"
              :class="{ 'assets-preview--clickable': item.type === 'file' || item.type === 'folder' }"
              @click.stop="openAssetPreviewOrFolder(item)"
            >
              <v-img
                v-if="isImage(item)"
                :src="getPreviewUrl(item)"
                cover
                class="assets-preview__media"
              >
                <template #error>
                  <div class="assets-preview__placeholder">
                    <v-icon icon="mdi-image-broken" size="48" />
                  </div>
                </template>
              </v-img>

              <video
                v-else-if="isVideo(item)"
                class="assets-preview__media"
                :src="getPreviewUrl(item)"
                muted
                preload="metadata"
              />

              <div v-else class="assets-preview__placeholder">
                <v-icon :icon="getEntryIcon(item)" size="56" />
              </div>
            </div>

            <v-card-text class="assets-grid-card__content pb-2">
              <div class="text-subtitle-2 text-truncate" :title="item.name">
                {{ item.name }}
              </div>

              <div
                v-if="item.type === 'file'"
                class="text-caption text-grey-lighten-1 text-truncate"
                :title="getEntrySubtitle(item)"
              >
                {{ getEntrySubtitle(item) }}
              </div>
            </v-card-text>

            <v-card-actions class="assets-grid-card__actions pt-0">
              <v-btn
                v-if="item.type === 'file'"
                icon="mdi-content-copy"
                size="small"
                variant="text"
                color="primary"
                :disabled="isWorking(item.path)"
                @click.stop="openCopyDialog(item)"
              />

              <v-btn
                v-if="isCompressible(item)"
                icon="mdi-archive-arrow-down-outline"
                size="small"
                variant="text"
                color="primary"
                :loading="workingPath === item.path && workingAction === 'compress'"
                :disabled="isWorking(item.path)"
                @click.stop="compressEntry(item)"
              />

              <v-spacer />

              <v-btn
                icon="mdi-folder-move"
                size="small"
                variant="text"
                :disabled="isWorking(item.path)"
                @click.stop="openMoveDialog(item)"
              />

              <v-btn
                icon="mdi-delete"
                size="small"
                variant="text"
                color="red"
                :loading="workingPath === item.path && workingAction === 'delete'"
                :disabled="isWorking(item.path)"
                @click.stop="openDeleteDialog(item)"
              />
            </v-card-actions>
          </v-card>
        </v-col>
      </v-row>
    </v-card-text>

    <AssetCreateFolderDialog
      v-model="createFolderDialog"
      :loading="createFolderLoading"
      :error="createFolderError"
      @create="createFolder"
    />

    <AssetDeleteConfirmDialog
      v-model="deleteDialog"
      :asset="selectedDeleteAsset"
      :rest-api="getRestApi"
      :loading="workingAction === 'delete'"
      @confirm="confirmDeleteEntry"
    />

    <AssetMoveDialog
      v-model="moveDialog"
      v-model:target="moveTarget"
      :source="moveSource"
      :loading="workingAction === 'move'"
      @move="moveEntry"
      @folder-created="handleMoveDialogFolderCreated"
    />

    <AssetCopyDialog
      v-model="copyDialog"
      :asset="selectedCopyAsset"
    />

    <AssetPreviewDialog
      v-model="previewDialog"
      :asset="selectedPreviewAsset"
      :rest-api="getRestApi"
      :disabled="workingAction !== null"
      :compressing="workingPath === selectedPreviewAsset?.path && workingAction === 'compress'"
      :deleting="workingPath === selectedPreviewAsset?.path && workingAction === 'delete'"
      @copy="openCopyDialog"
      @compress="compressEntry"
      @move="openMoveDialog"
      @delete="openDeleteDialog"
    />
  </v-card>
</template>

<script lang="ts">
import { mapState } from 'pinia'
import { useAppStore } from '@/stores/app'
import eventBus from '@/eventBus'
import AssetCopyDialog from '@/components/dialogs/AssetCopyDialog.vue'
import AssetPreviewDialog from '@/components/dialogs/AssetPreviewDialog.vue'
import AssetMoveDialog from '@/components/dialogs/AssetMoveDialog.vue'
import AssetCreateFolderDialog from '@/components/dialogs/AssetCreateFolderDialog.vue'
import AssetDeleteConfirmDialog from '@/components/dialogs/AssetDeleteConfirmDialog.vue'

type AssetStorageInfo = {
  root: string
  used: number
  total: number
  free: number
  available: number
  assetUsed: number
}

type AssetEntry = {
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
  components: {
    AssetCopyDialog,
    AssetPreviewDialog,
    AssetMoveDialog,
    AssetCreateFolderDialog,
    AssetDeleteConfirmDialog,
  },

  data() {
    return {
      entries: [] as AssetEntry[],
      currentPath: '',
      uploadFiles: [] as File[],
      fileInputKey: 0,
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
      deleteDialog: false,
      createFolderLoading: false,
      createFolderError: '',
      selectedCopyAsset: null as AssetEntry | null,
      selectedPreviewAsset: null as AssetEntry | null,
      selectedDeleteAsset: null as AssetEntry | null,
      storageInfo: null as AssetStorageInfo | null,
      storageLoading: false,
      assetsGridKey: 0,
      websocketConnectedHandler: null as null | (() => void),
    }
  },

  computed: {
    ...mapState(useAppStore, ['getRestApi']),

    storageUsedPercent(): number {
      if (!this.storageInfo?.total) return 0

      return Math.min(100, Math.max(0, (this.storageInfo.used / this.storageInfo.total) * 100))
    },

    filteredEntries(): AssetEntry[] {
      const query = String(this.searchQuery ?? '').trim().toLowerCase()

      if (!query) return this.entries

      return this.entries.filter((item: AssetEntry) => {
        return [
          item.name,
          item.path,
          this.getCompressedPath(item) ?? '',
        ].some(value => String(value).toLowerCase().includes(query))
      })
    },
  },

  watch: {
    '$route.fullPath': {
      async handler() {
        const path = this.getRouteAssetPath()

        if (path !== this.currentPath) {
          await this.fetchAssets(path, false)
        }
      },
    },
  },

  mounted() {
    this.currentPath = this.getRouteAssetPath()

    this.websocketConnectedHandler = () => {
      this.reloadAssetsPage()
    }

    eventBus.$on?.('websocket:connected', this.websocketConnectedHandler)

    this.fetchAssets(this.currentPath, false)
  },

  beforeUnmount() {
    if (this.websocketConnectedHandler) {
      eventBus.$off?.('websocket:connected', this.websocketConnectedHandler)
    }
  },

  methods: {
    async reloadAssetsPage() {
      await Promise.all([
        this.fetchAssets(this.currentPath),
      ])
    },
    requestAssetWebsocket(method: string, params: Record<string, any> = {}, timeout = 30_000): Promise<any> {
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

    async fetchStorageInfo() {
      this.storageLoading = true

      try {
        const response = await this.requestAssetWebsocket('assets_storage')
        const data = response?.data ?? response

        if (data?.error) {
          throw new Error(data.error)
        }

        this.storageInfo = data
      } catch (error: any) {
        this.errorMessage = error?.message ?? 'loading asset storage info failed'
        console.error('loading asset storage info failed', error)
      } finally {
        this.storageLoading = false
      }
    },

    async fetchAssets(path: string = '', syncRoute = true) {
      const requestSequence = ++this.requestSequence

      this.loading = true
      this.errorMessage = ''

      try {
        const response = await this.requestAssetWebsocket('assets_list', {
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
          await this.updateAssetRoute(this.currentPath, true)
        }
        this.entries = Array.isArray(data?.files) ? data.files : []
        this.assetsGridKey += 1

        await this.fetchStorageInfo()
      } catch (error: any) {
        this.errorMessage = error?.message ?? 'loading assets failed'
        console.error('loading assets failed', error)
      } finally {
        if (requestSequence === this.requestSequence) {
          this.loading = false
        }
      }
    },

    async uploadAssetFiles(value: File | File[] | null) {
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

        const request = await fetch(`${this.getRestApi}/api/assets/upload`, {
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

        this.uploadFiles = []
        this.fileInputKey += 1

        await Promise.all([
          this.fetchAssets(this.currentPath),
        ])
      } catch (error: any) {
        this.errorMessage = error?.message ?? 'upload failed'
        console.error('asset upload failed', error)
      } finally {
        this.uploading = false
      }
    },

    openDeleteDialog(item: AssetEntry | null) {
      if (!item?.path || this.workingAction) return

      this.selectedDeleteAsset = item
      this.deleteDialog = true
      this.errorMessage = ''
    },

    async confirmDeleteEntry() {
      await this.deleteEntry(this.selectedDeleteAsset)
    },

    async deleteEntry(item: AssetEntry | null) {
      if (!item?.path || this.workingAction) return

      this.workingPath = item.path
      this.workingAction = 'delete'
      this.errorMessage = ''

      try {
        const data = await this.requestAssetWebsocket('assets_delete', {
          path: item.path,
        })

        if (data?.error) {
          throw new Error(data.error)
        }

        this.deleteDialog = false
        this.selectedDeleteAsset = null

        await Promise.all([
          this.fetchAssets(this.currentPath),
        ])
      } catch (error: any) {
        this.errorMessage = error?.message ?? 'delete failed'
        console.error('asset delete failed', error)
      } finally {
        this.workingPath = null
        this.workingAction = null
      }
    },

    async compressEntry(item: AssetEntry | null) {
      if (!item?.path || !this.isCompressible(item) || this.workingAction) return

      this.workingPath = item.path
      this.workingAction = 'compress'
      this.errorMessage = ''

      try {
        const data = await this.requestAssetWebsocket('assets_compress', {
          path: item.path,
        }, 120_000)

        if (data?.error) {
          throw new Error(data.error)
        }

        await Promise.all([
          this.fetchAssets(this.currentPath),
        ])
      } catch (error: any) {
        this.errorMessage = error?.message ?? 'compress failed'
        console.error('asset compress failed', error)
      } finally {
        this.workingPath = null
        this.workingAction = null
      }
    },

    openCreateFolderDialog() {
      this.createFolderError = ''
      this.createFolderDialog = true
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
        const data = await this.requestAssetWebsocket('assets_create_folder', {
          path: this.currentPath,
          name,
        })

        if (data?.error) {
          throw new Error(data.error)
        }

        this.createFolderDialog = false
        await this.fetchAssets(this.currentPath)
      } catch (error: any) {
        this.createFolderError = error?.message ?? 'create folder failed'
        console.error('asset create folder failed', error)
      } finally {
        this.createFolderLoading = false
      }
    },

    openMoveDialog(item: AssetEntry | null) {
      if (!item?.path) return

      this.moveSource = item.path
      this.moveTarget = item.path
      this.moveDialog = true
      this.errorMessage = ''
    },


    async handleMoveDialogFolderCreated(folderPath: string) {
      const normalizedPath = this.normalizePath(folderPath)
      const parentPath = this.getParentPath(normalizedPath)

      await this.fetchAssets(parentPath || this.currentPath)
    },

    getParentPath(path: string): string {
      const parts = this.normalizePath(path).split('/').filter(Boolean)
      parts.pop()

      return parts.join('/')
    },

    async moveEntry() {
      if (!this.moveSource || !this.moveTarget || this.workingAction) return

      this.workingPath = this.moveSource
      this.workingAction = 'move'
      this.errorMessage = ''

      try {
        const data = await this.requestAssetWebsocket('assets_move', {
          source: this.moveSource,
          target: this.moveTarget,
        })

        if (data?.error) {
          throw new Error(data.error)
        }

        this.moveDialog = false
        await Promise.all([
          this.fetchAssets(this.currentPath),
        ])
      } catch (error: any) {
        this.errorMessage = error?.message ?? 'move failed'
        console.error('asset move failed', error)
      } finally {
        this.workingPath = null
        this.workingAction = null
      }
    },

    openCopyDialog(item: AssetEntry | null) {
      if (!item || item.type !== 'file') return

      this.selectedCopyAsset = item
      this.copyDialog = true
    },

    openPreviewDialog(item: AssetEntry | null) {
      if (!item || item.type !== 'file') return

      this.selectedPreviewAsset = item
      this.previewDialog = true
    },

    openAssetPreviewOrFolder(item: AssetEntry | null) {
      if (!item) return

      if (item.type === 'folder') {
        this.openFolder(item)
        return
      }

      this.openPreviewDialog(item)
    },

    openFolder(item: AssetEntry) {
      if (item.type !== 'folder') return

      this.openAssetPath(this.resolveEntryPath(item))
    },

    openParentFolder() {
      this.openAssetPath(this.getParentPath(this.currentPath))
    },

    async openAssetPath(path: string, replace = false) {
      const normalized = this.normalizePath(path)

      await this.updateAssetRoute(normalized, replace)

      if (normalized === this.currentPath) {
        await this.fetchAssets(normalized, false)
      }
    },

    getRouteAssetPath(): string {
      const raw = this.$route?.params?.assetPath

      if (Array.isArray(raw)) {
        return this.normalizePath(raw.map(part => this.decodeRoutePart(String(part))).join('/'))
      }

      if (typeof raw === 'string') {
        return this.normalizePath(raw.split('/').map(part => this.decodeRoutePart(part)).join('/'))
      }

      return this.getAssetPathFromUrl()
    },

    decodeRoutePart(part: string): string {
      try {
        return decodeURIComponent(part)
      } catch {
        return part
      }
    },

    getAssetPathFromUrl(): string {
      const pathname = window.location.pathname
      const marker = '/assets'
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

    getAssetRoutePath(path: string): string {
      const normalized = this.normalizePath(path)
      const encodedPath = normalized
        .split('/')
        .filter(Boolean)
        .map(part => encodeURIComponent(part))
        .join('/')

      return encodedPath ? `/assets/${encodedPath}` : '/assets'
    },

    async updateAssetRoute(path: string, replace = false) {
      const nextPath = this.getAssetRoutePath(path)

      if (this.$route?.path === nextPath) return

      if (replace) {
        await this.$router.replace({ path: nextPath })
        return
      }

      await this.$router.push({ path: nextPath })
    },

    resolveEntryPath(item: AssetEntry): string {
      const itemPath = this.normalizePath(item.path)

      if (!itemPath) return this.normalizePath(item.name)
      if (!this.currentPath) return itemPath
      if (itemPath === this.currentPath || itemPath.startsWith(`${this.currentPath}/`)) return itemPath

      return this.joinPath(this.currentPath, itemPath)
    },

    joinPath(...parts: string[]): string {
      return parts
        .map(part => this.normalizePath(part))
        .filter(Boolean)
        .join('/')
    },

    normalizePath(value: string): string {
      return String(value ?? '')
        .replace(/\\/g, '/')
        .replace(/^\/+/, '')
        .replace(/\/+/g, '/')
        .replace(/\/+$/, '')
    },

    isWorking(path: string): boolean {
      return this.workingPath === path || this.workingAction !== null
    },

    getEntryIcon(item: AssetEntry): string {
      if (item.type === 'folder') return 'mdi-folder'
      if (this.isImage(item)) return 'mdi-image'
      if (this.isVideo(item)) return 'mdi-video'
      if (this.isAudio(item)) return 'mdi-music'

      return 'mdi-file'
    },

    getEntrySubtitle(item: AssetEntry): string {
      const parts = []

      if (item.type === 'folder') {
        parts.push(item.path)
      } else {
        parts.push(this.formatFileSize(item.size))
      }

      const compressed = this.getCompressedPath(item)

      if (compressed) {
        parts.push(`compressed`)
      }

      return parts.filter(Boolean).join(' · ')
    },

    getCompressedPath(item: AssetEntry): string | null {
      if (typeof item.compressed === 'string') return this.normalizePath(item.compressed)
      if (typeof item.asset === 'object' && typeof item.asset?.compressed === 'string') return this.normalizePath(item.asset.compressed)

      return null
    },

    getPreviewUrl(item: AssetEntry): string {
      const compressed = this.getCompressedPath(item)
      return this.getAssetUrl(compressed || item.path)
    },

    getAssetUrl(path: string): string {
      const normalized = this.normalizePath(path)
      const encoded = normalized
        .split('/')
        .map(part => encodeURIComponent(part))
        .join('/')

      return `${this.getRestApi}/${encoded}`
    },

    isImage(item: AssetEntry): boolean {
      return item.type === 'file' && /\.(jpe?g|png|webp|gif|svg)$/i.test(item.path)
    },

    isSvg(item: AssetEntry | null): boolean {
      return item?.type === 'file' && /\.svg$/i.test(item.path)
    },

    isCompressible(item: AssetEntry | null): boolean {
      if (!item?.path || item.type !== 'file') return false
      if (this.isSvg(item)) return false

      return this.isImage(item) || this.isVideo(item) || this.isAudio(item)
    },

    isVideo(item: AssetEntry): boolean {
      return item.type === 'file' && /\.(mp4|webm|mov|mkv)$/i.test(item.path)
    },

    isAudio(item: AssetEntry): boolean {
      return item.type === 'file' && /\.(mp3|flac|wav|ogg|m4a|opus)$/i.test(item.path)
    },

    formatFileSize(size: any): string {
      const bytes = Number(size)

      if (!Number.isFinite(bytes)) return ''

      const units = ['B', 'KB', 'MB', 'GB']
      let value = bytes
      let unitIndex = 0

      while (value >= 1024 && unitIndex < units.length - 1) {
        value /= 1024
        unitIndex += 1
      }

      return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
    },
  },
}
</script>

<style scoped>
.assets-grid {
  max-height: calc(100vh - 342px);
  overflow-y: auto;
}


.assets-grid-card {
  cursor: default;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.assets-grid-card__content {
  flex: 1 1 auto;
}

.assets-grid-card__actions {
  margin-top: auto;
  min-height: 44px;
}

.assets-grid-card--folder {
  cursor: pointer;
}

.assets-preview {
  aspect-ratio: 16 / 9;
  background: rgba(0, 0, 0, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
}

.assets-preview__media {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.assets-preview--clickable {
  cursor: zoom-in;
}

.assets-top-row {
  align-items: stretch;
}

.assets-storage-card,
.assets-upload-card {
  min-height: 116px;
}

.assets-upload-input {
  width: 100%;
}

.assets-storage-info {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px 18px;
}

.assets-storage-info--compact > div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-width: 0;
}

.assets-storage-info--compact span:last-child {
  white-space: nowrap;
}

.min-width-0 {
  min-width: 0;
}

@media (max-width: 960px) {
  .assets-storage-card,
  .assets-upload-card {
    min-height: auto;
  }
}

.assets-preview__placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.65);
}
</style>
