<template>
  <v-dialog
    :model-value="modelValue"
    max-width="760"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <v-card color="grey-darken-4">
      <v-toolbar
        flat
        density="compact"
      >
        <v-toolbar-title class="d-flex align-center">
          {{ $t('assets.moveDialog') }}
        </v-toolbar-title>
        <v-btn icon="mdi-close" @click="$emit('update:modelValue', false)"></v-btn>
      </v-toolbar>

      <v-card-text>
        <input type="hidden" :value="source" name="source" />

        <v-text-field
          :model-value="target"
          :label="$t('common.target')+' '+$t('file.name')"
          variant="outlined"
          readonly
          hide-details
          class="mb-4"
          @keyup.enter="$emit('move')"
        />

        <v-card
          color="grey-darken-3"
          variant="flat"
          class="asset-folder-explorer"
        >
          <v-card-title class="d-flex align-center justify-space-between py-2">
            <div class="d-flex align-center ga-2 min-width-0">
              <v-btn
                icon="mdi-arrow-left"
                size="small"
                variant="text"
                :disabled="explorerLoading || !explorerPath"
                @click.prevent.stop="openParentFolder"
              />

              <div class="min-width-0">
                <div class="text-subtitle-2">{{ $t('common.target') }} {{ $t('file.folder') }}</div>
                <div class="text-caption text-grey-lighten-1 text-truncate">
                  /{{ explorerPath || '' }}
                </div>
              </div>
            </div>

            <v-btn
              icon="mdi-refresh"
              size="small"
              variant="text"
              :loading="explorerLoading"
              @click="fetchFolders(explorerPath)"
            />
          </v-card-title>

          <v-divider />

          <div class="asset-folder-explorer__create pa-3">
            <v-text-field
              v-model="createFolderName"
              :label="$t('assets.createFolder')"
              variant="outlined"
              density="compact"
              hide-details
              :disabled="explorerLoading || createFolderLoading"
              @keyup.enter="createFolder"
            >
              <template #append-inner>
                <v-btn
                  icon="mdi-folder-plus"
                  size="small"
                  variant="text"
                  :loading="createFolderLoading"
                  :disabled="!normalizedCreateFolderName || explorerLoading"
                  @click.prevent.stop="createFolder"
                />
              </template>
            </v-text-field>
          </div>

          <v-divider />

          <v-card-text class="pa-0">
            <v-alert
              v-if="explorerError"
              type="error"
              color="red-darken-3"
              density="compact"
              class="ma-3"
              :text="explorerError"
            />

            <v-list
              v-else
              density="compact"
              bg-color="transparent"
              class="asset-folder-explorer__list"
            >
              <v-list-item
                :active="true"
                prepend-icon="mdi-check-circle"
                @click.prevent.stop="selectCurrentFolder"
              >
                <v-list-item-title>
                  {{ $t('file.folder') }}
                </v-list-item-title>
                <v-list-item-subtitle>
                  /{{ explorerPath || '' }}
                </v-list-item-subtitle>
              </v-list-item>

              <v-divider />

              <v-list-item
                v-if="canGoUp"
                prepend-icon="mdi-arrow-up"
                :disabled="explorerLoading"
                @click.prevent.stop="openParentFolder"
              >
                <v-list-item-title>{{ $t('file.folderUp') }}</v-list-item-title>
                <v-list-item-subtitle>/{{ parentExplorerPath || '' }}</v-list-item-subtitle>
              </v-list-item>

              <v-divider v-if="canGoUp" />

              <v-list-item
                v-for="folder in folders"
                :key="folder.path"
                prepend-icon="mdi-folder"
                :disabled="explorerLoading"
                @click.prevent.stop="openFolder(folder)"
              >
                <v-list-item-title>{{ folder.name }}</v-list-item-title>
                <v-list-item-subtitle>{{ folder.path }}</v-list-item-subtitle>
              </v-list-item>

              <v-list-item v-if="!explorerLoading && !canGoUp && folders.length === 0">
                <v-list-item-title class="text-grey-lighten-1">
                  {{ $t('assets.noAssetsFound') }}
                </v-list-item-title>
              </v-list-item>
            </v-list>
          </v-card-text>
        </v-card>
      </v-card-text>

      <v-card-actions>
        <v-spacer />

        <v-btn
          variant="text"
          :disabled="loading"
          @click="$emit('update:modelValue', false)"
        >
          {{ $t('common.cancel') }}
        </v-btn>

        <v-btn
          color="primary"
          variant="flat"
          :loading="loading"
          :disabled="!target || target === source"
          @click="$emit('move')"
        >
          {{ $t('assets.move') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang="ts">
import eventBus from '@/eventBus'

type AssetEntry = {
  name: string
  path: string
  type: 'file' | 'folder'
  [key: string]: any
}

export default {
  name: 'AssetMoveDialog',

  props: {
    modelValue: {
      type: Boolean,
      default: false,
    },
    source: {
      type: String,
      default: '',
    },
    target: {
      type: String,
      default: '',
    },
    loading: {
      type: Boolean,
      default: false,
    },
  },

  emits: [
    'update:modelValue',
    'update:target',
    'move',
    'folder-created',
  ],

  data() {
    return {
      explorerPath: '',
      explorerEntries: [] as AssetEntry[],
      explorerLoading: false,
      explorerError: '',
      explorerRequestSequence: 0,
      createFolderName: '',
      createFolderLoading: false,
    }
  },

  computed: {
    normalizedCreateFolderName(): string {
      return this.normalizeFolderName(this.createFolderName)
    },

    folders(): AssetEntry[] {
      return this.explorerEntries.filter((entry: AssetEntry) => entry.type === 'folder')
    },

    canGoUp(): boolean {
      return Boolean(this.explorerPath)
    },

    parentExplorerPath(): string {
      return this.getParentPath(this.explorerPath)
    },

  },

  watch: {
    modelValue(open: boolean) {
      if (open) {
        this.initExplorer()
      }
    },

    source() {
      if (this.modelValue) {
        this.initExplorer()
      }
    },
  },

  methods: {
    initExplorer() {
      const startPath = this.getParentPath(this.target || this.source)

      this.explorerPath = startPath
      this.createFolderName = ''
      this.updateTargetForFolder(startPath)
      this.fetchFolders(startPath)
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

    async createFolder() {
      const folderName = this.normalizedCreateFolderName

      if (!folderName || this.createFolderLoading || this.explorerLoading) return

      const folderPath = this.joinPath(this.explorerPath, folderName)

      this.createFolderLoading = true
      this.explorerError = ''

      try {
        const response = await this.requestAssetWebsocket('assets_create_folder', {
          path: folderPath,
        })
        const data = response?.data ?? response

        if (data?.error) {
          this.explorerError = data.error
          return
        }

        this.createFolderName = ''
        this.explorerPath = folderPath
        this.updateTargetForFolder(folderPath)
        this.$emit('folder-created', folderPath)
        await this.fetchFolders(folderPath)
      } catch (error: any) {
        this.explorerError = error?.message ?? 'create folder failed'
        console.error('creating asset folder failed', error)
      } finally {
        this.createFolderLoading = false
      }
    },

    async fetchFolders(path: string = '') {
      const requestSequence = ++this.explorerRequestSequence

      this.explorerLoading = true
      this.explorerError = ''

      try {
        const normalizedPath = this.normalizePath(path)
        const response = await this.requestAssetWebsocket('assets_list', {
          path: normalizedPath,
        })
        const data = response?.data ?? response

        if (requestSequence !== this.explorerRequestSequence) return

        if (data?.error) {
          this.explorerError = data.error
          this.explorerEntries = []
          return
        }

        this.explorerPath = this.normalizePath(data?.path ?? normalizedPath)
        this.explorerEntries = Array.isArray(data?.files) ? data.files : []
        this.updateTargetForFolder(this.explorerPath)
      } catch (error: any) {
        if (requestSequence !== this.explorerRequestSequence) return

        this.explorerError = error?.message ?? 'loading folders failed'
        this.explorerEntries = []
        console.error('loading asset folders failed', error)
      } finally {
        if (requestSequence === this.explorerRequestSequence) {
          this.explorerLoading = false
        }
      }
    },

    openFolder(folder: AssetEntry) {
      if (folder.type !== 'folder' || this.explorerLoading) return

      const folderPath = this.resolveFolderPath(folder)

      this.explorerPath = folderPath
      this.updateTargetForFolder(folderPath)
      this.fetchFolders(folderPath)
    },

    openParentFolder() {
      this.fetchFolders(this.getParentPath(this.explorerPath))
    },

    selectCurrentFolder() {
      this.updateTargetForFolder(this.explorerPath)
    },

    updateTargetForFolder(folderPath: string) {
      const basename = this.getBasename(this.source)
      const target = this.joinPath(folderPath, basename)

      this.$emit('update:target', target)
    },

    resolveFolderPath(folder: AssetEntry): string {
      const folderPath = this.normalizePath(folder.path)

      if (!folderPath) return this.joinPath(this.explorerPath, folder.name)
      if (!this.explorerPath) return folderPath
      if (folderPath === this.explorerPath || folderPath.startsWith(`${this.explorerPath}/`)) return folderPath

      return this.joinPath(this.explorerPath, folderPath)
    },

    getParentPath(path: string): string {
      const parts = this.normalizePath(path).split('/').filter(Boolean)
      parts.pop()

      return parts.join('/')
    },

    getBasename(path: string): string {
      const parts = this.normalizePath(path).split('/').filter(Boolean)

      return parts.pop() ?? ''
    },

    joinPath(...parts: string[]): string {
      return parts
        .map(part => this.normalizePath(part))
        .filter(Boolean)
        .join('/')
    },

    normalizeFolderName(value: string): string {
      return this.normalizePath(value)
        .split('/')
        .filter(Boolean)
        .pop() ?? ''
    },

    normalizePath(value: string): string {
      return String(value ?? '')
        .replace(/\\/g, '/')
        .replace(/^\/+/, '')
        .replace(/\/+/g, '/')
        .replace(/\/+$/, '')
    },
  },
}
</script>

<style scoped>
.asset-folder-explorer {
  overflow: hidden;
}

.asset-folder-explorer__create {
  background: rgba(255, 255, 255, 0.02);
}

.asset-folder-explorer__list {
  max-height: 300px;
  overflow-y: auto;
}

.min-width-0 {
  min-width: 0;
}
</style>
