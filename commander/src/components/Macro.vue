<script lang="ts">
import { mapState } from 'pinia'
import { useAppStore } from '@/stores/app.ts'
import { sleep } from '@/helper/GeneralHelper.ts'

export default {
  name: 'Macro',

  props: {
    macro: {
      type: Object,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    disabled: {
      type: Boolean,
      default: false,
    },
    deleting: {
      type: Boolean,
      default: false,
    },
  },

  emits: ['edit', 'delete'],

  data() {
    return {
      loading: false,
      icon: 'mdi-play',
      color: '',
    }
  },

  computed: {
    ...mapState(useAppStore, ['getRestApi']),

    tasks(): any[] {
      return Array.isArray(this.macro?.tasks) ? this.macro.tasks : []
    },

    apis(): string[] {
      return Array.isArray(this.macro?.apis) ? this.macro.apis : []
    },

    taskCount(): number {
      return this.tasks.length
    },

    apiCount(): number {
      return this.apis.length
    },
  },

  methods: {
    stringify(value: any): string {
      if (value === undefined || value === null) return ''
      if (typeof value === 'string') return value

      try {
        return JSON.stringify(value)
      } catch (error) {
        return String(value)
      }
    },

    async triggerMacro() {
      if (this.loading || this.color !== '' || this.disabled) return

      this.loading = true

      try {
        await fetch(`${this.getRestApi}/api/macro`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ macro: this.name }),
        })

        this.color = 'success'
        this.icon = 'mdi-check'
      } catch (error) {
        this.color = 'error'
        this.icon = 'mdi-alert'
      } finally {
        this.loading = false
      }

      await sleep(2_500)

      this.color = ''
      this.icon = 'mdi-play'
    },
  },
}
</script>

<template>
  <v-expansion-panel class="macro-panel" bg-color="grey-darken-4">
    <template #title>
      <div class="macro-panel__title">
        <v-btn
          :loading="loading"
          :disabled="disabled"
          @click.stop="triggerMacro"
          :icon="icon"
          :color="color"
          :aria-label="$t('macro.trigger') || 'Trigger macro'"
          class="macro-panel__trigger"
          size="small"
          density="compact"
          variant="plain"
        />

        <span class="macro-panel__name text-truncate" :title="name">
          {{ name }}
        </span>

        <div class="macro-panel__meta d-none d-sm-flex">
          <v-chip size="x-small" variant="tonal">
            {{ taskCount }} tasks
          </v-chip>
          <v-chip v-if="apiCount" size="x-small" variant="tonal">
            {{ apiCount }} APIs
          </v-chip>
        </div>

        <v-spacer />
      </div>
    </template>

    <v-expansion-panel-text class="macro-panel__content pa-0">
      <div class="macro-panel__details px-4 pt-3 pb-3">
        <div class="macro-panel__details-text min-width-0">
          <div class="text-subtitle-2 text-truncate" :title="name">
            {{ name }}
          </div>
          <div class="text-caption text-grey-lighten-1">
            {{ taskCount }} tasks{{ apiCount ? ` · ${apiCount} APIs` : '' }}
          </div>
        </div>

        <div class="macro-panel__actions">
          <v-btn
            prepend-icon="mdi-pencil"
            size="small"
            variant="tonal"
            color="primary"
            :disabled="disabled"
            @click="$emit('edit', name, macro)"
          >
            {{ $t('common.edit') || 'Edit' }}
          </v-btn>

          <v-btn
            prepend-icon="mdi-delete"
            size="small"
            variant="tonal"
            color="red"
            :loading="deleting"
            :disabled="disabled"
            @click="$emit('delete', name, macro)"
          >
            {{ $t('common.delete') || 'Delete' }}
          </v-btn>
        </div>
      </div>

      <div v-if="apis.length" class="px-4 pb-3 d-flex flex-wrap ga-1">
        <v-chip
          v-for="api in apis"
          :key="api"
          size="x-small"
          variant="tonal"
          prepend-icon="mdi-api"
        >
          {{ api }}
        </v-chip>
      </div>

      <v-table density="compact" class="macro-panel__table">
        <thead>
          <tr>
            <th class="text-left" style="width: 180px">
              {{ $t('macro.table.channel') || 'Channel' }}
            </th>
            <th class="text-left" style="width: 180px">
              {{ $t('macro.table.method') || 'Method' }}
            </th>
            <th class="text-left">
              {{ $t('macro.table.data') || 'Data' }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(task, index) in tasks" :key="index">
            <td>{{ task.channel }}</td>
            <td>{{ task.method ?? task.message ?? '' }}</td>
            <td class="macro-panel__data">
              {{ stringify(task.data ?? task.check ?? task.endpoint ?? task.asset ?? '') }}
            </td>
          </tr>
        </tbody>
      </v-table>
    </v-expansion-panel-text>
  </v-expansion-panel>
</template>

<style scoped lang="scss">
.macro-panel {
  border-bottom: thin solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.macro-panel__title {
  display: flex;
  align-items: center;
  min-width: 0;
  width: 100%;
  gap: 10px;
}

.macro-panel__trigger {
  flex: 0 0 auto;
}

.macro-panel__name {
  min-width: 120px;
}

.macro-panel__meta {
  align-items: center;
  gap: 6px;
}

.macro-panel__details {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.macro-panel__details-text {
  flex: 1 1 auto;
}

.macro-panel__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
}

@media (max-width: 600px) {
  .macro-panel__details {
    align-items: stretch;
    flex-direction: column;
  }

  .macro-panel__actions {
    justify-content: flex-end;
  }
}

.macro-panel__table {
  background: transparent;
}

.macro-panel__data {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
  font-size: 0.78rem;
  word-break: break-word;
}
</style>
