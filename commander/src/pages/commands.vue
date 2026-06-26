<template>
  <v-card class="overflow-auto mx-auto" max-height="100%" elevation="0" color="transparent" max-width="100%">
    <v-card-title class="d-flex align-center justify-space-between px-3 pt-3">
      <div class="d-flex align-center ga-2 min-width-0">
        <v-icon icon="mdi-console-line" />
        <div class="min-width-0">
          <div class="text-truncate">{{ $t('commands.title') || 'Commands' }}</div>
        </div>
      </div>

      <div class="d-flex align-center ga-2">
        <v-btn icon="mdi-refresh" variant="text" :loading="loading" @click="refreshCommands" />
        <v-btn prepend-icon="mdi-plus" color="primary" variant="tonal" @click="openCreateDialog">
          {{ $t('commands.create') || 'Add command' }}
        </v-btn>
      </div>
    </v-card-title>

    <v-card-text>
      <v-row density="compact" class="mb-3">
        <v-col cols="12" md="6">
          <StorageCard ref="storageCard" :hideCommandUsed="false"/>
        </v-col>

        <v-col cols="12" md="6">
          <UploadCard
            :label="$t('commands.upload') || 'Upload command'"
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
        :label="$t('commands.search') || 'Search commands'"
        prepend-inner-icon="mdi-magnify"
        clearable
        variant="outlined"
        density="comfortable"
        hide-details
        class="mb-3"
      />

      <v-alert v-if="errorMessage" type="error" color="red-darken-3" class="mb-4" :text="errorMessage" />
      <v-alert v-if="filteredCommands.length === 0" type="info" color="grey-darken-3" :text="$t('commands.none') || 'No commands found'" />

      <v-list v-else class="command-list" bg-color="transparent">
        <v-list-item
          v-for="(item, index) in filteredCommands"
          :key="item.name"
          :class="index % 2 === 0 ? 'command-row--even' : 'command-row--odd'"
          rounded="lg"
        >
          <template #prepend>
            <v-avatar color="grey-darken-3" rounded="lg" size="42">
              <v-icon icon="mdi-console" />
            </v-avatar>
          </template>

          <v-list-item-title class="d-flex align-center ga-2 min-width-0">
            <span class="text-truncate">!{{ item.name }}</span>
            <v-chip v-if="item.command?.requiresBroadcaster" size="x-small" color="purple" variant="tonal">Broadcaster</v-chip>
            <v-chip v-else-if="item.command?.requiresMod" size="x-small" color="blue" variant="tonal">Mod</v-chip>
            <v-chip v-else-if="item.command?.requiresVip" size="x-small" color="pink" variant="tonal">VIP</v-chip>
          </v-list-item-title>

          <v-list-item-subtitle class="text-truncate">
            {{ commandSubtitle(item) }}
          </v-list-item-subtitle>

          <template #append>
            <div class="d-flex align-center ga-1">
              <v-btn icon="mdi-pencil" variant="text" :disabled="workingAction !== null" @click="openEditor(item)" />
              <v-btn icon="mdi-delete" variant="text" color="error" :loading="workingName === item.name && workingAction === 'delete'" :disabled="workingAction !== null && workingName !== item.name" @click="openDeleteDialog(item)" />
            </div>
          </template>
        </v-list-item>
      </v-list>
    </v-card-text>

    <CommandCreateDialog
      ref="createDialogRef"
      v-model="createDialog"
      :loading="workingAction === 'create'"
      @save="createCommand"
    />

    <CommandEditorDialog
      ref="editorDialogRef"
      v-model="editorDialog"
      :command-entry="selectedCommand"
      :loading="workingAction === 'save' || workingAction === 'read'"
      @save="saveCommand"
    />

    <v-dialog v-model="deleteDialog" max-width="420">
      <v-card>
        <v-card-title>{{ $t('commands.delete') || 'Delete command' }}</v-card-title>
        <v-card-text>
          {{ $t('commands.deleteConfirm') || 'Delete this command?' }}
          <strong v-if="selectedCommand?.name">!{{ selectedCommand.name }}</strong>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="deleteDialog = false">{{ $t('common.cancel') || 'Cancel' }}</v-btn>
          <v-btn color="error" variant="tonal" :loading="workingAction === 'delete'" @click="confirmDeleteCommand">
            {{ $t('common.delete') || 'Delete' }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-card>
</template>

<script lang="ts">
import { mapState } from 'pinia'
import { useAppStore } from '@/stores/app'
import { getWebsocketClient } from '@/plugins/websocketInstance'
import StorageCard from '@/components/cards/StorageCard.vue'
import UploadCard from '@/components/cards/UploadCard.vue'
import CommandCreateDialog from '@/components/dialogs/CommandCreateDialog.vue'
import CommandEditorDialog from '@/components/dialogs/CommandEditorDialog.vue'

type CommandEntry = { name: string; command: any; file?: string }

export default {
  name: 'Commands',

  components: {
    StorageCard,
    UploadCard,
    CommandCreateDialog,
    CommandEditorDialog,
  },

  data() {
    return {
      searchQuery: '',
      loading: false,
      uploading: false,
      errorMessage: '',
      createDialog: false,
      editorDialog: false,
      deleteDialog: false,
      selectedCommand: null as CommandEntry | null,
      commands: {} as Record<string, any>,
      files: [] as any[],
      workingName: null as string | null,
      workingAction: null as string | null,
    }
  },

  computed: {
    ...mapState(useAppStore, ['getRestApi']),

    commandList(): CommandEntry[] {
      return Object.entries(this.commands ?? {})
        .map(([name, command]) => ({ name, command, file: (command as any)?.file ?? `${name}.yaml` }))
        .sort((a, b) => a.name.localeCompare(b.name))
    },

    filteredCommands(): CommandEntry[] {
      const query = String(this.searchQuery ?? '').trim().toLowerCase()
      if (!query) return this.commandList

      return this.commandList.filter((item) => {
        return item.name.toLowerCase().includes(query) || JSON.stringify(item.command ?? {}).toLowerCase().includes(query)
      })
    },
  },

  mounted() {
    void this.refreshCommands()
  },

  methods: {
    async requestWebsocket(method: string, params: Record<string, any> = {}, timeout = 20_000): Promise<any> {
      const client = getWebsocketClient()
      if (!client) throw new Error('websocket is not connected')
      const response = await client.request(method, params, timeout)
      return response?.params ?? response
    },

    unwrapResponse(response: any, method = ''): any {
      const resultKey = method ? `result_${method}` : ''
      const candidates = [response, response?.data, response?.payload, response?.result, response?.data?.result].filter(Boolean)

      if (resultKey) {
        for (const candidate of candidates) {
          if (candidate?.[resultKey] !== undefined) return candidate[resultKey]
        }
      }

      for (const candidate of candidates) {
        if (candidate?.error) throw new Error(candidate.error?.message ?? candidate.error)
        if (candidate?.message && candidate?.error === true) throw new Error(candidate.message)
      }

      return response?.data ?? response
    },

    async requestEndpoint(method: string, endpoint: string, params: Record<string, any> = {}, timeout = 20_000): Promise<any> {
      try {
        const response = await this.requestWebsocket(method, params, timeout)
        return this.unwrapResponse(response, method)
      } catch (websocketError) {
        const response = await fetch(`${this.getRestApi}/api/${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params),
        })
        const data = await response.json().catch(() => ({}))
        const payload = data?.data ?? data
        if (!response.ok || payload?.error || data?.error) throw new Error(payload?.message ?? payload?.error ?? data?.error ?? `${endpoint} failed`)
        return payload
      }
    },

    async refreshCommands() {
      this.loading = true
      this.errorMessage = ''

      try {
        const data = await this.requestEndpoint('commands_list', 'commands/list')
        this.files = data?.files ?? []
        this.commands = data?.commands ?? data?.configured_commands ?? {}
      } catch (error: any) {
        this.errorMessage = error?.message ?? 'commands list failed'
      } finally {
        this.loading = false
      }
    },

    commandSubtitle(item: CommandEntry) {
      const aliases = Array.isArray(item.command?.aliases) ? item.command.aliases : Array.isArray(item.command?.alias) ? item.command.alias : []
      const params = Array.isArray(item.command?.params) ? item.command.params : []
      const parts = [`macro: ${item.command?.macro ?? `command_${item.name}`}`]
      if (aliases.length) parts.push(`aliases: ${aliases.join(', ')}`)
      if (params.length) parts.push(`${params.length} param(s)`)
      return parts.join(' · ')
    },

    openCreateDialog() {
      this.createDialog = true
      this.$nextTick(() => (this.$refs.createDialogRef as any)?.open?.())
    },

    async openEditor(item: CommandEntry) {
      this.workingName = item.name
      this.workingAction = 'read'
      this.errorMessage = ''

      try {
        const data = await this.requestEndpoint('commands_read', 'commands/read', {
          path: item.file,
          file: item.file,
          name: item.name,
        })

        const command = data?.command ?? data?.data?.command ?? data

        this.selectedCommand = {
          ...item,
          file: data?.path ?? data?.file ?? item.file,
          command: {
            ...(item.command ?? {}),
            ...(command ?? {}),
          },
        }

        this.editorDialog = true
        await this.$nextTick()
        ;(this.$refs.editorDialogRef as any)?.open?.()
      } catch (error: any) {
        this.errorMessage = error?.message ?? 'command read failed'
      } finally {
        this.workingName = null
        this.workingAction = null
      }
    },

    openDeleteDialog(item: CommandEntry) {
      this.selectedCommand = item
      this.deleteDialog = true
    },

    async uploadFiles(files: File[] | FileList) {
      const fileList = Array.from(files as any)
      if (fileList.length === 0) return

      this.uploading = true
      this.errorMessage = ''

      try {
        const formData = new FormData()
        fileList.forEach((file) => formData.append('files', file))

        const response = await fetch(`${this.getRestApi}/api/commands/upload`, { method: 'POST', body: formData })
        const data = await response.json().catch(() => ({}))
        const payload = data?.data ?? data

        if (!response.ok || payload?.error || data?.error) throw new Error(payload?.message ?? payload?.error ?? 'command upload failed')

        await this.refreshCommands()
        await (this.$refs.storageCard as any)?.fetchStorageInfo?.()
      } catch (error: any) {
        this.errorMessage = error?.message ?? 'command upload failed'
      } finally {
        this.uploading = false
      }
    },

    async createCommand(payload: any) {
      this.workingName = payload?.name ?? null
      this.workingAction = 'create'
      this.errorMessage = ''

      try {
        await this.writeCommand(payload)
        this.createDialog = false
        await this.refreshCommands()
        await (this.$refs.storageCard as any)?.fetchStorageInfo?.()
      } catch (error: any) {
        this.errorMessage = error?.message ?? 'create command failed'
      } finally {
        this.workingName = null
        this.workingAction = null
      }
    },

    async saveCommand(payload: any) {
      this.workingName = payload?.name ?? null
      this.workingAction = 'save'
      this.errorMessage = ''

      try {
        await this.writeCommand(payload)
        this.editorDialog = false
        await this.refreshCommands()
        await (this.$refs.storageCard as any)?.fetchStorageInfo?.()
      } catch (error: any) {
        this.errorMessage = error?.message ?? 'save command failed'
      } finally {
        this.workingName = null
        this.workingAction = null
      }
    },

    async writeCommand(payload: any) {
      const name = this.normalizeName(payload.name)
      const macroName = `command_${name}`
      const commandContent = this.yamlDump({
        name,
        aliases: payload.aliases ?? [],
        params: payload.params ?? [],
        macro: macroName,
        userCooldown: payload.userCooldown || undefined,
        globalCooldown: payload.globalCooldown || undefined,
        enforce_primary: payload.enforce_primary === true,
        requiresBroadcaster: payload.requiresBroadcaster === true,
        requiresMod: payload.requiresMod === true,
        requiresVip: payload.requiresVip === true,
      })

      await this.requestEndpoint('commands_edit', 'commands/edit', {
        path: payload.path ?? `${name}.yaml`,
        name,
        content: commandContent,
      })

      await this.requestEndpoint('macro_edit', 'macro/edit', {
        path: `${macroName}.yaml`,
        name: macroName,
        content: payload.macroContent || this.defaultMacroContent(macroName),
      })
    },

    async confirmDeleteCommand() {
      if (!this.selectedCommand) return

      this.workingName = this.selectedCommand.name
      this.workingAction = 'delete'
      this.errorMessage = ''

      try {
        await this.requestEndpoint('commands_delete', 'commands/delete', {
          path: this.selectedCommand.file,
          name: this.selectedCommand.name,
        })
        this.deleteDialog = false
        this.selectedCommand = null
        await this.refreshCommands()
        await (this.$refs.storageCard as any)?.fetchStorageInfo?.()
      } catch (error: any) {
        this.errorMessage = error?.message ?? 'delete command failed'
      } finally {
        this.workingName = null
        this.workingAction = null
      }
    },

    normalizeName(value: any) {
      return String(value ?? '')
        .trim()
        .replace(/^!+/, '')
        .replace(/^command_/, '')
        .replace(/\s+/g, '_')
        .replace(/[^a-zA-Z0-9_.-]+/g, '_')
        .replace(/^_+|_+$/g, '')
    },

    defaultMacroContent(name: string) {
      return `name: ${name}\napis: []\ntasks: []\n`
    },

    yamlDump(value: any) {
      const lines: string[] = []
      for (const [key, rawValue] of Object.entries(value)) {
        if (rawValue === undefined || rawValue === null || rawValue === false || rawValue === '') continue
        if (Array.isArray(rawValue)) {
          if (rawValue.length === 0) {
            lines.push(`${key}: []`)
          } else {
            lines.push(`${key}:`)
            rawValue.forEach((item: any) => {
              if (item && typeof item === 'object') {
                lines.push(`  - ${Object.entries(item).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join('\n    ')}`)
              } else {
                lines.push(`  - ${JSON.stringify(item)}`)
              }
            })
          }
          continue
        }
        lines.push(`${key}: ${JSON.stringify(rawValue)}`)
      }
      return `${lines.join('\n')}\n`
    },
  },
}
</script>

<style scoped lang="scss">
.command-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.command-row--even {
  background: rgba(var(--v-theme-surface), 0.34);
}

.command-row--odd {
  background: rgba(var(--v-theme-surface), 0.18);
}

.min-width-0 {
  min-width: 0;
}
</style>
