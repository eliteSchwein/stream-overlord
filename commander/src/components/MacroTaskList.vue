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
        :inside-loop="isItemInsideLoop(item)"
        @remove="removeItem(index)"
        @move-up="moveItem(index, -1)"
        @move-down="moveItem(index, 1)"
      />
    </v-expansion-panels>

    <v-alert
      v-else
      type="info"
      color="warning"
      density="comfortable"
      variant="tonal"
      class="mb-3"
      text="No tasks yet"
    />

    <v-menu v-model="addTaskMenuOpen" :close-on-content-click="false">
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
        <template v-for="preset in availablePresets" :key="preset.title">
          <v-list-group v-if="preset.children?.length" :value="preset.title">
            <template #activator="{ props: groupProps }">
              <v-list-item
                v-bind="groupProps"
                :prepend-icon="preset.icon"
                :title="preset.title"
                @click.stop
              />
            </template>

            <v-list-item
              v-for="child in preset.children"
              :key="child.title"
              :prepend-icon="child.icon"
              :title="child.title"
              @click.stop="addTaskAndClose(child.factory())"
            />
          </v-list-group>

          <v-list-item
            v-else
            :prepend-icon="preset.icon"
            :title="preset.title"
            @click.stop="addTaskAndClose(preset.factory())"
          />
        </template>
      </v-list>
    </v-menu>
  </div>
</template>

<script lang="ts">
import {
  MacroAlertTaskAccordion,
  MacroAnimationTaskAccordion,
  MacroConditionTaskAccordion,
  MacroDummyAlertTaskAccordion,
  MacroEffectTaskAccordion,
  MacroEndMacroTaskAccordion,
  MacroFunctionTaskAccordion,
  MacroMacroTaskAccordion,
  MacroFileTaskAccordion,
  MacroLoopControlTaskAccordion,
  MacroLoopTaskAccordion,
  MacroMediaTaskAccordion,
  MacroMusicTaskAccordion,
  MacroNeopixelTaskAccordion,
  MacroObsTaskAccordion,
  MacroRestTaskAccordion,
  MacroTaskAccordion,
  MacroWebhookTaskAccordion,
  MacroWebsocketTaskAccordion,
  MacroWledTaskAccordion,
  MacroYoloboxTaskAccordion, MacroVariableSetTaskAccordion, MacroVariableGetTaskAccordion,
  MacroChannelPointAcceptTaskAccordion, MacroChannelPointCancelTaskAccordion,
  MacroChannelPointPauseTaskAccordion, MacroChannelPointToggleTaskAccordion,
  MacroKeyboardTaskAccordion,
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
    MacroWledTaskAccordion,
    MacroMusicTaskAccordion,
    MacroMacroTaskAccordion,
    MacroFileTaskAccordion,
    MacroLoopControlTaskAccordion,
    MacroLoopTaskAccordion,
    MacroMediaTaskAccordion,
    MacroWebhookTaskAccordion,
    MacroYoloboxTaskAccordion,
    MacroNeopixelTaskAccordion,
    MacroEffectTaskAccordion,
    MacroAnimationTaskAccordion,
    MacroEndMacroTaskAccordion,
    MacroVariableGetTaskAccordion,
    MacroVariableSetTaskAccordion,
    MacroChannelPointAcceptTaskAccordion,
    MacroChannelPointCancelTaskAccordion,
    MacroChannelPointPauseTaskAccordion,
    MacroChannelPointToggleTaskAccordion,
    MacroKeyboardTaskAccordion,
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
    insideLoop: {
      type: Boolean,
      default: false,
    },
  },

  computed: {
    currentTaskListComponent(): any {
      return this.taskListComponent || this.$options
    },

    availablePresets(): any[] {
      return this.presets
        .map((preset: any) => {
          if (!preset.children?.length) return preset

          const children = preset.children.filter((child: any) => {
            if (child.loopOnly === true) return this.insideLoop
            return true
          })

          return {
            ...preset,
            children,
          }
        })
        .filter((preset: any) => !preset.children || preset.children.length > 0)
    },
  },

  data() {
    return {
      addTaskMenuOpen: false,
      presets: [
        {
          title: 'Conditions',
          icon: 'mdi-source-branch',
          children: [
            {
              title: 'If condition',
              icon: 'mdi-source-branch',
              factory: () => this.createConditionTask(),
            },
            {
              title: 'For loop',
              icon: 'mdi-repeat',
              factory: () => this.createLoopTask(),
            },
            {
              title: 'Loop: break',
              icon: 'mdi-stop-circle-outline',
              loopOnly: true,
              factory: () => this.createTask({ channel: 'loop', method: 'break' }),
            },
            {
              title: 'Loop: continue',
              icon: 'mdi-skip-next-outline',
              loopOnly: true,
              factory: () => this.createTask({ channel: 'loop', method: 'continue' }),
            },
          ],
        },
        {
          title: 'Macro',
          icon: 'mdi-star-circle',
          children: [
            {
              title: 'Run Macro',
              icon: 'mdi-playlist-play',
              factory: () => this.createTask({ channel: 'macro', method: '', data: {} }),
            },
            {
              title: 'End macro',
              icon: 'mdi-stop-circle-outline',
              factory: () => this.createTask({ channel: 'condition', method: 'end_macro' }),
            },
          ],
        },
        {
          title: 'Alert',
          icon: 'mdi-bell-ring',
          factory: () => this.createTask({ channel: 'alert', message: '', asset: '' }),
        },
        {
          title: 'Animation',
          icon: 'mdi-animation-play',
          factory: () => this.createTask({ channel: 'animation', method: 'play' }),
        },
        {
          title: 'Send DM',
          icon: 'mdi-message-lock-outline',
          factory: () => this.createTask({ channel: 'function', method: 'send_dm', data: { user: '', content: '' } }),
        },
        {
          title: 'Chat message',
          icon: 'mdi-message-text-outline',
          factory: () => this.createTask({ channel: 'function', method: 'send_message', data: { content: '' } }),
        },
        {
          title: 'Sleep',
          icon: 'mdi-timer-sand',
          factory: () => this.createTask({ channel: 'function', method: 'sleep', data: { time: 1000 } }),
        },
        {
          title: 'Random',
          icon: 'mdi-dice-multiple-outline',
          factory: () => this.createTask({ channel: 'function', method: 'random', data: { key: '', min: 0, max: 100 } }),
        },
        {
          title: 'Toggle auto macro',
          icon: 'mdi-toggle-switch-outline',
          factory: () => this.createTask({ channel: 'function', method: 'toggle_auto_macro', data: { name: '', enabled: true } }),
        },
        {
          title: 'File: read asset folder',
          icon: 'mdi-folder-open-outline',
          factory: () => this.createTask({ channel: 'file', method: 'read_folder', data: { path: null, key: 'files', fileExtension: null } }),
        },
        {
          title: 'Channel point',
          icon: 'mdi-star-circle',
          children: [
            {
              title: 'Accept reward',
              icon: 'mdi-check-circle-outline',
              factory: () => this.createTask({ channel: 'channel_point', method: 'accept' }),
            },
            {
              title: 'Cancel reward',
              icon: 'mdi-close-circle-outline',
              factory: () => this.createTask({ channel: 'channel_point', method: 'cancel' }),
            },
            {
              title: 'Pause reward',
              icon: 'mdi-pause-circle-outline',
              factory: () => this.createTask({ channel: 'channel_point', method: 'pause', data: { name: '' } }),
            },
            {
              title: 'Unpause reward',
              icon: 'mdi-play-circle-outline',
              factory: () => this.createTask({ channel: 'channel_point', method: 'unpause', data: { name: '' } }),
            },
            {
              title: 'Set pause state',
              icon: 'mdi-toggle-switch-outline',
              factory: () => this.createTask({ channel: 'channel_point', method: 'toggle_pause', data: { name: '', state: 'pause' } }),
            },
            {
              title: 'Enable reward',
              icon: 'mdi-toggle-switch',
              factory: () => this.createTask({ channel: 'channel_point', method: 'enable', data: { name: '' } }),
            },
            {
              title: 'Disable reward',
              icon: 'mdi-toggle-switch-off-outline',
              factory: () => this.createTask({ channel: 'channel_point', method: 'disable', data: { name: '' } }),
            },
            {
              title: 'Set enabled state',
              icon: 'mdi-toggle-switch-outline',
              factory: () => this.createTask({ channel: 'channel_point', method: 'toggle', data: { name: '', state: 'enable' } }),
            },
          ],
        },
        {

          title: 'Variables',
          icon: 'mdi-variable',
          children: [
            {
              title: 'Set Variable',
              icon: 'mdi-database-export-outline',
              factory: () => this.createTask({ channel: 'variable', method: 'set', data: { value: null, key: '', to_file: false } }),
            },
            {
              title: 'Get Variable',
              icon: 'mdi-database-import-outline',
              factory: () => this.createTask({ channel: 'variable', method: 'get', data: { key: '' } }),
            },
          ]
        },
        {
          title: 'Audio',
          icon: 'mdi-volume-high',
          children: [
            {
              title: 'Speak',
              icon: 'mdi-account-voice',
              factory: () => this.createTask({ channel: 'function', method: 'speak', data: { content: '', event_uuid: "${eventUuid}" } }),
            },
            {
              title: 'Song request',
              icon: 'mdi-music-note-plus',
              factory: () => this.createTask({ channel: 'function', method: 'song_request', data: { url: '' } }),
            },
            {
              title: 'Toggle song requests',
              icon: 'mdi-music-note-off-outline',
              factory: () => this.createTask({ channel: 'function', method: 'song_request_toggle', data: {} }),
            },
          ],
        },
        {
          title: 'Expert',
          icon: 'mdi-function',
          children: [
            {
              title: 'Websocket',
              icon: 'mdi-connection',
              factory: () => this.createTask({ channel: 'websocket', method: '', data: {} }),
            },
            {
              title: 'Rest',
              icon: 'mdi-web',
              factory: () => this.createTask({ channel: 'rest', method: '', data: {} }),
            },
            {
              title: 'Raw task',
              icon: 'mdi-code-json',
              factory: () => this.createTask({ channel: '', method: '', data: {} }),
            },
            {
              title: 'Keyboard',
              icon: 'mdi-keyboard-outline',
              factory: () => this.createTask({
                channel: 'keyboard',
                method: 'press',
                data: {
                  name: 'macro',
                  keys: [],
                  duration: undefined,
                },
              }),
            },
          ],
        },
      ],
    }
  },

  methods: {
    componentFor(item: any) {
      if (item?.type === 'condition') return 'MacroConditionTaskAccordion'
      if (item?.type === 'loop' || (item?.task?.channel === 'loop' && item?.task?.method === 'for')) return 'MacroLoopTaskAccordion'
      if (item?.task?.channel === 'loop' && ['break', 'continue', 'end_for'].includes(item?.task?.method)) return 'MacroLoopControlTaskAccordion'
      if (item?.task?.channel === 'condition' && item?.task?.method === 'end_macro') return 'MacroEndMacroTaskAccordion'

      if (item?.task?.channel === 'variable' && item?.task?.method === 'get') {
        return 'MacroVariableGetTaskAccordion'
      }

      if (item?.task?.channel === 'variable' && item?.task?.method === 'set') {
        return 'MacroVariableSetTaskAccordion'
      }

      if (item?.task?.channel === 'channel_point' && item?.task?.method === 'accept') {
        return 'MacroChannelPointAcceptTaskAccordion'
      }

      if (item?.task?.channel === 'channel_point' && item?.task?.method === 'cancel') {
        return 'MacroChannelPointCancelTaskAccordion'
      }

      if (item?.task?.channel === 'channel_point' && ['pause', 'unpause', 'toggle_pause'].includes(item?.task?.method)) {
        return 'MacroChannelPointPauseTaskAccordion'
      }

      if (item?.task?.channel === 'channel_point' && ['enable', 'disable', 'toggle'].includes(item?.task?.method)) {
        return 'MacroChannelPointToggleTaskAccordion'
      }

      if (item?.task?.channel === 'keyboard') {
        return 'MacroKeyboardTaskAccordion'
      }

      const componentsByChannel: Record<string, string> = {
        alert: 'MacroAlertTaskAccordion',
        dummy_alert: 'MacroDummyAlertTaskAccordion',
        function: 'MacroFunctionTaskAccordion',
        websocket: 'MacroWebsocketTaskAccordion',
        rest: 'MacroRestTaskAccordion',
        obs: 'MacroObsTaskAccordion',
        wled: 'MacroWledTaskAccordion',
        music: 'MacroMusicTaskAccordion',
        macro: 'MacroMacroTaskAccordion',
        file: 'MacroFileTaskAccordion',
        media: 'MacroMediaTaskAccordion',
        webhook: 'MacroWebhookTaskAccordion',
        yolobox: 'MacroYoloboxTaskAccordion',
        neopixel: 'MacroNeopixelTaskAccordion',
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

    createLoopTask() {
      return {
        id: this.uid(),
        type: 'loop',
        task: {
          channel: 'loop',
          method: 'for',
          data: {
            key: 'item',
            from: 1,
            to: 10,
          },
        },
        children: [],
      }
    },

    isItemInsideLoop(item: any) {
      return this.insideLoop || item?.type === 'loop' || (item?.task?.channel === 'loop' && item?.task?.method === 'for')
    },

    addTask(item: any) {
      ;(this.items as any[]).push(item)
    },

    addTaskAndClose(item: any) {
      this.addTask(item)
      this.addTaskMenuOpen = false
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
