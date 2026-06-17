<template>
  <div class="macro-task-list" :class="{ 'macro-task-list--nested': nested }">
    <v-expansion-panels v-if="items.length" variant="accordion" multiple>
      <component
        :is="componentFor(item)"
        v-for="(item, index) in items"
        :key="item.id"
        :item="item"
        :index="index"
        :depth="depth"
        :task-list-component="currentTaskListComponent"
        @remove="removeItem(index)"
        @move-up="moveItem(index, -1)"
        @move-down="moveItem(index, 1)"
      />
    </v-expansion-panels>

    <v-alert
      v-else
      type="info"
      color="grey-darken-3"
      density="comfortable"
      variant="tonal"
      class="mb-3"
      text="No tasks yet"
    />

    <v-menu>
      <template #activator="{ props }">
        <v-btn
          v-bind="props"
          prepend-icon="mdi-plus"
          variant="tonal"
          color="primary"
          size="small"
          class="mt-3"
        >
          Add task
        </v-btn>
      </template>

      <v-list density="comfortable">
        <v-list-item
          v-for="preset in presets"
          :key="preset.title"
          :prepend-icon="preset.icon"
          :title="preset.title"
          @click="addTask(preset.factory())"
        />
      </v-list>
    </v-menu>
  </div>
</template>

<script lang="ts">
import {
  MacroAlertTaskAccordion,
  MacroAnimationTaskAccordion,
  MacroChannelPointTaskAccordion,
  MacroConditionTaskAccordion,
  MacroDummyAlertTaskAccordion,
  MacroEffectTaskAccordion,
  MacroEndMacroTaskAccordion,
  MacroFunctionTaskAccordion,
  MacroMacroTaskAccordion,
  MacroMusicTaskAccordion,
  MacroNeopixelTaskAccordion,
  MacroObsTaskAccordion,
  MacroRestTaskAccordion,
  MacroTaskAccordion,
  MacroVariableTaskAccordion,
  MacroWebhookTaskAccordion,
  MacroWebsocketTaskAccordion,
  MacroWledTaskAccordion,
  MacroYoloboxTaskAccordion,
} from '@/components/accordions/macro'

export default {
  name: 'MacroTaskList',

  provide() {
    return {
      MacroTaskListComponent: this.$options,
    }
  },

  components: {
    MacroTaskAccordion,
    MacroConditionTaskAccordion,
    MacroAlertTaskAccordion,
    MacroDummyAlertTaskAccordion,
    MacroFunctionTaskAccordion,
    MacroWebsocketTaskAccordion,
    MacroRestTaskAccordion,
    MacroObsTaskAccordion,
    MacroVariableTaskAccordion,
    MacroWledTaskAccordion,
    MacroMusicTaskAccordion,
    MacroMacroTaskAccordion,
    MacroWebhookTaskAccordion,
    MacroYoloboxTaskAccordion,
    MacroNeopixelTaskAccordion,
    MacroChannelPointTaskAccordion,
    MacroEffectTaskAccordion,
    MacroAnimationTaskAccordion,
    MacroEndMacroTaskAccordion,
  },

  props: {
    items: {
      type: Array,
      required: true,
    },
    depth: {
      type: Number,
      default: 0,
    },
    nested: {
      type: Boolean,
      default: false,
    },
    taskListComponent: {
      type: [Object, Function, String],
      default: null,
    },
  },

  computed: {
    currentTaskListComponent(): any {
      return this.taskListComponent || this.$options
    },
  },

  data() {
    return {
      presets: [
        {
          title: 'If condition',
          icon: 'mdi-source-branch',
          factory: () => this.createConditionTask(),
        },
        {
          title: 'End macro',
          icon: 'mdi-stop-circle-outline',
          factory: () => this.createTask({ channel: 'condition', method: 'end_macro' }),
        },
        {
          title: 'Alert',
          icon: 'mdi-bell-ring',
          factory: () => this.createTask({ channel: 'alert', message: '', asset: '' }),
        },
        {
          title: 'Function: send DM',
          icon: 'mdi-message-lock-outline',
          factory: () => this.createTask({ channel: 'function', method: 'send_dm', data: { user: '', content: '' } }),
        },
        {
          title: 'Function: chat message',
          icon: 'mdi-message-text-outline',
          factory: () => this.createTask({ channel: 'function', method: 'send_message', data: { content: '' } }),
        },
        {
          title: 'Function: sleep',
          icon: 'mdi-timer-sand',
          factory: () => this.createTask({ channel: 'function', method: 'sleep', data: { time: 1000 } }),
        },
        {
          title: 'Function: speak',
          icon: 'mdi-account-voice',
          factory: () => this.createTask({ channel: 'function', method: 'speak', data: { content: '', event_uuid: '' } }),
        },
        {
          title: 'Function: random',
          icon: 'mdi-dice-multiple-outline',
          factory: () => this.createTask({ channel: 'function', method: 'random', data: { key: '', min: 0, max: 100 } }),
        },
        {
          title: 'Function: song request',
          icon: 'mdi-music-note-plus',
          factory: () => this.createTask({ channel: 'function', method: 'song_request', data: { url: '' } }),
        },
        {
          title: 'Function: toggle song requests',
          icon: 'mdi-music-note-off-outline',
          factory: () => this.createTask({ channel: 'function', method: 'song_request_toggle', data: {} }),
        },
        {
          title: 'Function: toggle auto macro',
          icon: 'mdi-toggle-switch-outline',
          factory: () => this.createTask({ channel: 'function', method: 'toggle_auto_macro', data: { name: '', enabled: true } }),
        },
        {
          title: 'Websocket',
          icon: 'mdi-connection',
          factory: () => this.createTask({ channel: 'websocket', method: '', data: {} }),
        },
        {
          title: 'Channel point',
          icon: 'mdi-star-circle',
          factory: () => this.createTask({ channel: 'channel_point', method: 'accept' }),
        },
        {
          title: 'Raw task',
          icon: 'mdi-code-json',
          factory: () => this.createTask({ channel: '', method: '', data: {} }),
        },
      ],
    }
  },

  methods: {
    componentFor(item: any) {
      if (item?.type === 'condition') return 'MacroConditionTaskAccordion'
      if (item?.task?.channel === 'condition' && item?.task?.method === 'end_macro') return 'MacroEndMacroTaskAccordion'

      const componentsByChannel: Record<string, string> = {
        alert: 'MacroAlertTaskAccordion',
        dummy_alert: 'MacroDummyAlertTaskAccordion',
        function: 'MacroFunctionTaskAccordion',
        websocket: 'MacroWebsocketTaskAccordion',
        rest: 'MacroRestTaskAccordion',
        obs: 'MacroObsTaskAccordion',
        variable: 'MacroVariableTaskAccordion',
        wled: 'MacroWledTaskAccordion',
        music: 'MacroMusicTaskAccordion',
        macro: 'MacroMacroTaskAccordion',
        webhook: 'MacroWebhookTaskAccordion',
        yolobox: 'MacroYoloboxTaskAccordion',
        neopixel: 'MacroNeopixelTaskAccordion',
        channel_point: 'MacroChannelPointTaskAccordion',
        effect: 'MacroEffectTaskAccordion',
        animation: 'MacroAnimationTaskAccordion',
      }

      return componentsByChannel[item?.task?.channel] ?? 'MacroTaskAccordion'
    },

    uid() {
      return `${Date.now()}_${Math.random().toString(16).slice(2)}`
    },

    createTask(task: any) {
      return {
        id: this.uid(),
        type: 'task',
        task,
      }
    },

    createConditionTask() {
      return {
        id: this.uid(),
        type: 'condition',
        task: {
          channel: 'condition',
          method: 'if',
          check: '',
        },
        children: [],
        branches: [],
      }
    },

    addTask(item: any) {
      ;(this.items as any[]).push(item)
    },

    removeItem(index: number) {
      ;(this.items as any[]).splice(index, 1)
    },

    moveItem(index: number, direction: number) {
      const target = index + direction
      const items = this.items as any[]

      if (target < 0 || target >= items.length) return

      const [item] = items.splice(index, 1)
      items.splice(target, 0, item)
    },
  },
}
</script>

<style scoped>
.macro-task-list--nested {
  border-left: 2px solid rgba(var(--v-theme-primary), .45);
  padding-left: 12px;
  margin-left: 4px;
}
</style>
