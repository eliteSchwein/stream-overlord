<template>
  <v-expansion-panel class="macro-task-accordion">
    <v-expansion-panel-title>
      <div class="d-flex align-center min-width-0 w-100">
        <v-icon :icon="icon" size="20" class="mr-2" />
        <span class="text-caption mr-2 text-medium-emphasis">#{{ index + 1 }}</span>
        <span class="text-truncate font-weight-medium">{{ title }}</span>
        <v-spacer />
        <v-chip size="x-small" variant="tonal">{{ task.channel || 'task' }}</v-chip>
      </div>
    </v-expansion-panel-title>

    <v-expansion-panel-text>
      <v-row density="comfortable">
        <v-col cols="12" md="4">
          <v-text-field v-model="task.channel" label="Channel" density="comfortable" variant="outlined" hide-details />
        </v-col>

        <v-col v-if="task.channel !== 'alert' && task.channel !== 'dummy_alert'" cols="12" md="4">
          <v-text-field v-model="task.method" label="Method" density="comfortable" variant="outlined" hide-details />
        </v-col>

        <v-col v-if="task.channel === 'rest'" cols="12" md="4">
          <v-text-field v-model="task.endpoint" label="Endpoint" density="comfortable" variant="outlined" hide-details />
        </v-col>

        <template v-if="task.channel === 'alert'">
          <v-col cols="12" md="6">
            <v-text-field v-model="task.message" label="Message" density="comfortable" variant="outlined" hide-details />
          </v-col>
          <v-col cols="12" md="6">
            <v-text-field v-model="task.asset" label="Asset" density="comfortable" variant="outlined" hide-details />
          </v-col>
        </template>

        <template v-else-if="task.channel === 'dummy_alert'">
          <v-col cols="12" md="6">
            <v-text-field v-model="task.message" label="Message" density="comfortable" variant="outlined" hide-details />
          </v-col>
          <v-col cols="12" md="3">
            <v-text-field v-model="task.icon" label="Icon" density="comfortable" variant="outlined" hide-details />
          </v-col>
          <v-col cols="12" md="3">
            <v-text-field v-model="task.duration" label="Duration" density="comfortable" variant="outlined" hide-details />
          </v-col>
        </template>

        <v-col v-if="usesData" cols="12">
          <v-textarea
            v-model="dataText"
            label="Data"
            density="comfortable"
            variant="outlined"
            rows="6"
            auto-grow
            :error-messages="dataError"
            @update:model-value="updateData"
          />
        </v-col>

        <v-col v-if="!usesData && !['alert', 'dummy_alert'].includes(task.channel)" cols="12">
          <v-textarea
            v-model="rawText"
            label="Raw task fields"
            density="comfortable"
            variant="outlined"
            rows="6"
            auto-grow
            :error-messages="rawError"
            @update:model-value="updateRaw"
          />
        </v-col>
      </v-row>

      <div class="d-flex justify-end ga-2 mt-2">
        <v-btn icon="mdi-arrow-up" size="small" variant="text" @click="$emit('move-up')" />
        <v-btn icon="mdi-arrow-down" size="small" variant="text" @click="$emit('move-down')" />
        <v-btn icon="mdi-delete" size="small" variant="text" color="error" @click="$emit('remove')" />
      </div>
    </v-expansion-panel-text>
  </v-expansion-panel>
</template>

<script lang="ts">
export default {
  name: 'MacroTaskAccordion',

  props: {
    item: {
      type: Object,
      required: true,
    },
    index: {
      type: Number,
      required: true,
    },
    depth: {
      type: Number,
      default: 0,
    },
  },

  emits: ['remove', 'move-up', 'move-down'],

  data() {
    return {
      dataText: '',
      dataError: '',
      rawText: '',
      rawError: '',
    }
  },

  computed: {
    task(): any {
      return (this.item as any).task
    },

    title(): string {
      if (this.task.channel === 'alert') return `Alert: ${this.task.message || 'empty message'}`
      if (this.task.channel === 'dummy_alert') return `Dummy alert: ${this.task.message || 'empty message'}`
      if (this.task.channel === 'function') return `Function: ${this.task.method || 'method'}`
      if (this.task.channel === 'websocket') return `Websocket: ${this.task.method || 'method'}`
      if (this.task.channel === 'macro') return `Macro: ${this.task.method || 'name'}`
      return `${this.task.channel || 'Task'}${this.task.method ? `: ${this.task.method}` : ''}`
    },

    icon(): string {
      const icons: Record<string, string> = {
        alert: 'mdi-bell-ring',
        dummy_alert: 'mdi-bell-outline',
        function: 'mdi-function',
        websocket: 'mdi-connection',
        rest: 'mdi-web',
        obs: 'mdi-video-box',
        wled: 'mdi-led-strip-variant',
        music: 'mdi-music',
        webhook: 'mdi-webhook',
        yolobox: 'mdi-video-switch',
        neopixel: 'mdi-lightbulb-on',
        effect: 'mdi-auto-fix',
      }

      return icons[this.task.channel] ?? 'mdi-code-json'
    },

    usesData(): boolean {
      return ['obs', 'rest', 'websocket', 'function', 'wled', 'music', 'macro', 'webhook', 'yolobox', 'neopixel', 'effect'].includes(this.task.channel)
    },
  },

  watch: {
    task: {
      immediate: true,
      deep: true,
      handler() {
        this.refreshTextFields()
      },
    },
  },

  methods: {
    refreshTextFields() {
      this.dataText = JSON.stringify(this.task.data ?? {}, null, 2)
      this.rawText = JSON.stringify(this.task, null, 2)
    },

    updateData() {
      try {
        this.task.data = this.dataText.trim() ? JSON.parse(this.dataText) : {}
        this.dataError = ''
      } catch (error: any) {
        this.dataError = error?.message ?? 'Invalid JSON'
      }
    },

    updateRaw() {
      try {
        const parsed = this.rawText.trim() ? JSON.parse(this.rawText) : {}
        Object.keys(this.task).forEach((key) => delete this.task[key])
        Object.assign(this.task, parsed)
        this.rawError = ''
      } catch (error: any) {
        this.rawError = error?.message ?? 'Invalid JSON'
      }
    },
  },
}
</script>
