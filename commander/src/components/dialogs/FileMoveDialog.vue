<template>
  <v-dialog
    :model-value="modelValue"
    max-width="760"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <v-card color="grey-darken-4">
      <v-toolbar flat density="compact">
        <v-toolbar-title class="d-flex align-center">
          {{ title }}
        </v-toolbar-title>
        <v-btn icon="mdi-close" @click="$emit('update:modelValue', false)" />
      </v-toolbar>

      <v-card-text>
        <input type="hidden" :value="source" name="source" />

        <v-text-field
          :model-value="targetName"
          :label="targetLabel"
          variant="outlined"
          hide-details
          class="mb-2"
          @update:model-value="updateTargetName"
          @keyup.enter="$emit('move')"
        />

        <v-text-field
          :model-value="target"
          :label="$t('dialogs.fileMoveDialog.targetPath')"
          variant="outlined"
          density="compact"
          readonly
          hide-details
          class="mb-4"
        />

        <v-card color="grey-darken-3" variant="flat" class="file-folder-explorer">
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
                <div class="text-subtitle-2">{{ targetFolderLabel }}</div>
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

          <div class="pa-3">
            <v-text-field
              v-model="createFolderName"
              :label="createFolderLabel"
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
              class="file-folder-explorer__list"
            >
              <v-list-item
                :active="true"
                prepend-icon="mdi-check-circle"
                @click.prevent.stop="selectCurrentFolder"
              >
                <v-list-item-title>
                  {{ folderLabel }}
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
                <v-list-item-title>{{ folderUpLabel }}</v-list-item-title>
                <v-list-item-subtitle>/{{ parentFolderPath || '' }}</v-list-item-subtitle>
              </v-list-item>

              <v-list-item
                v-for="folder in folders"
                :key="folder.path"
                prepend-icon="mdi-folder"
                :disabled="explorerLoading"
                @click.prevent.stop="openFolder(folder.path)"
              >
                <v-list-item-title>{{ folder.name }}</v-list-item-title>
                <v-list-item-subtitle>/{{ folder.path }}</v-list-item-subtitle>
              </v-list-item>

              <v-list-item v-if="folders.length === 0 && !explorerLoading">
                <v-list-item-title class="text-grey-lighten-1">
                  {{ noFoldersLabel }}
                </v-list-item-title>
              </v-list-item>
            </v-list>
          </v-card-text>
        </v-card>
      </v-card-text>

      <v-card-actions>
        <v-spacer />

        <v-btn variant="text" :disabled="loading" @click="$emit('update:modelValue', false)">
          {{ cancelLabel }}
        </v-btn>

        <v-btn
          color="primary"
          variant="flat"
          :loading="loading"
          :disabled="!source || !target || source === target"
          @click="$emit('move')"
        >
          {{ moveLabel }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang="ts">
import { getWebsocketClient } from '@/plugins/websocketInstance'

type FolderEntry = {
  name: string
  path: string
  type: 'file' | 'folder'
}

export default {
  name: 'FileMoveDialog',

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
    listMethod: {
      type: String,
      required: true,
    },
    createFolderMethod: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      default: 'Move',
    },
    targetLabel: {
      type: String,
      default: 'Target name',
    },
    targetFolderLabel: {
      type: String,
      default: 'Target folder',
    },
    createFolderLabel: {
      type: String,
      default: 'Create folder',
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
    cancelLabel: {
      type: String,
      default: 'Cancel',
    },
    moveLabel: {
      type: String,
      default: 'Move',
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
      folders: [] as FolderEntry[],
      explorerLoading: false,
      explorerError: '',
      createFolderName: '',
      createFolderLoading: false,
    }
  },

  computed: {
    normalizedCreateFolderName(): string {
      return this.normalizePath(this.createFolderName)
    },

    canGoUp(): boolean {
      return this.explorerPath.length > 0
    },

    parentFolderPath(): string {
      const parts = this.normalizePath(this.explorerPath).split('/').filter(Boolean)
      parts.pop()

      return parts.join('/')
    },

    sourceName(): string {
      const parts = this.normalizePath(this.source).split('/').filter(Boolean)
      return parts.pop() ?? ''
    },

    targetName(): string {
      const parts = this.normalizePath(this.target || this.source).split('/').filter(Boolean)
      return parts.pop() ?? this.sourceName
    },
  },

  watch: {
    modelValue(value: boolean) {
      if (value) {
        this.explorerPath = this.getParentPath(this.target || this.source)
        this.createFolderName = ''
        this.fetchFolders(this.explorerPath)
      }
    },

    source() {
      if (this.modelValue) {
        this.explorerPath = this.getParentPath(this.target || this.source)
        this.fetchFolders(this.explorerPath)
      }
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

    async fetchFolders(path = '') {
      this.explorerLoading = true
      this.explorerError = ''

      try {
        const response = await this.requestWebsocket(this.listMethod, {
          path: this.normalizePath(path),
        })
        const data = response?.data ?? response

        if (data?.error) {
          throw new Error(data.error)
        }

        this.explorerPath = this.normalizePath(data?.path ?? path)
        this.folders = (Array.isArray(data?.files) ? data.files : [])
          .filter((entry: FolderEntry) => entry.type === 'folder')
      } catch (error: any) {
        this.explorerError = error?.message ?? 'loading folders failed'
      } finally {
        this.explorerLoading = false
      }
    },

    async createFolder() {
      if (!this.normalizedCreateFolderName || this.createFolderLoading) return

      this.createFolderLoading = true
      this.explorerError = ''

      try {
        const response = await this.requestWebsocket(this.createFolderMethod, {
          path: this.explorerPath,
          name: this.normalizedCreateFolderName,
        })
        const data = response?.data ?? response

        if (data?.error) {
          throw new Error(data.error)
        }

        this.createFolderName = ''
        this.$emit('folder-created', data?.path ?? '')
        await this.fetchFolders(this.explorerPath)
      } catch (error: any) {
        this.explorerError = error?.message ?? 'create folder failed'
      } finally {
        this.createFolderLoading = false
      }
    },

    updateTargetName(value: string) {
      this.$emit('update:target', this.joinPath(this.explorerPath, value || this.sourceName))
    },

    selectCurrentFolder() {
      this.$emit('update:target', this.joinPath(this.explorerPath, this.targetName || this.sourceName))
    },

    openFolder(path: string) {
      this.explorerPath = this.normalizePath(path)
      this.$emit('update:target', this.joinPath(this.explorerPath, this.targetName || this.sourceName))
      this.fetchFolders(this.explorerPath)
    },

    openParentFolder() {
      this.openFolder(this.parentFolderPath)
    },

    getParentPath(value: string): string {
      const parts = this.normalizePath(value).split('/').filter(Boolean)
      parts.pop()

      return parts.join('/')
    },

    joinPath(...parts: string[]): string {
      return parts
        .map(part => this.normalizePath(part))
        .filter(Boolean)
        .join('/')
    },

    normalizePath(value: any): string {
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
.file-folder-explorer__list {
  max-height: 360px;
  overflow-y: auto;
}

.min-width-0 {
  min-width: 0;
}
</style>
