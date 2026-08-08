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

    taskCount(): number {
      return Array.isArray(this.macro?.tasks) ? this.macro.tasks.length : 0
    },
  },

  methods: {
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
  <div class="macro-row">
    <div class="macro-row__content">
      <div class="macro-row__name text-truncate" :title="name">
        {{ name }}
      </div>

      <v-chip
        size="x-small"
        variant="tonal"
        class="macro-row__count"
      >
        {{ $t('components.macro.taskCount', { count: taskCount }) }}
      </v-chip>
    </div>

    <div class="macro-row__actions">
      <v-btn
        :loading="loading"
        :disabled="disabled"
        :color="color || 'success'"
        size="small"
        variant="tonal"
        @click="triggerMacro"
      >
        <v-icon :icon="icon" />
        <span class="d-none d-sm-inline ml-1">
          {{ $t('macro.run') }}
        </span>
      </v-btn>

      <v-btn
        size="small"
        variant="tonal"
        color="primary"
        :disabled="disabled"
        @click="$emit('edit', name, macro)"
      >
        <v-icon icon="mdi-pencil" />
        <span class="d-none d-sm-inline ml-1">
          {{ $t('common.edit') }}
        </span>
      </v-btn>

      <v-btn
        size="small"
        variant="tonal"
        color="red"
        :loading="deleting"
        :disabled="disabled"
        @click="$emit('delete', name, macro)"
      >
        <v-icon icon="mdi-delete" />
        <span class="d-none d-sm-inline ml-1">
          {{ $t('common.delete') }}
        </span>
      </v-btn>
    </div>
  </div>
</template>

<style scoped lang="scss">
.macro-row {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 56px;
  padding: 8px 14px;
  background: rgb(var(--v-theme-grey-darken-4));
  border-bottom: thin solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.macro-row__content {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex: 1 1 auto;
}

.macro-row__name {
  min-width: 0;
  font-weight: 500;
}

.macro-row__count {
  flex: 0 0 auto;
}

.macro-row__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
}

@media (max-width: 600px) {
  .macro-row {
    padding-inline: 10px;
  }

  .macro-row__content {
    gap: 6px;
  }

  .macro-row__actions {
    gap: 4px;
  }

  .macro-row__actions .v-btn {
    min-width: 36px;
    padding-inline: 8px;
  }
}
</style>
