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

            <template v-for="child in preset.children" :key="child.title">
              <v-list-group v-if="child.children?.length" :value="`${preset.title}:${child.title}`">
                <template #activator="{ props: childGroupProps }">
                  <v-list-item
                    v-bind="childGroupProps"
                    :prepend-icon="child.icon"
                    :title="child.title"
                    @click.stop
                  />
                </template>

                <v-list-item
                  v-for="grandChild in child.children"
                  :key="grandChild.title"
                  :prepend-icon="grandChild.icon"
                  :title="grandChild.title"
                  @click.stop="addTaskAndClose(grandChild.factory())"
                />
              </v-list-group>

              <v-list-item
                v-else
                :prepend-icon="child.icon"
                :title="child.title"
                @click.stop="addTaskAndClose(child.factory())"
              />
            </template>
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
import { mapState } from 'pinia'
import { useAppStore } from '@/stores/app'
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
  MacroNeopixelTaskAccordion,
  MacroObsTaskAccordion,
  MacroTaskAccordion,
  MacroWebhookTaskAccordion,
  MacroWebsocketTaskAccordion,
  MacroVariableSetTaskAccordion, MacroVariableGetTaskAccordion,
  MacroChannelPointAcceptTaskAccordion, MacroChannelPointCancelTaskAccordion,
  MacroChannelPointPauseTaskAccordion, MacroChannelPointToggleTaskAccordion,
  MacroKeyboardTaskAccordion,
} from '@/components/accordions/macro'
import {
  MacroObsDisableSourceFilterTaskAccordion,
  MacroObsEnableSourceFilterTaskAccordion,
  MacroObsHideSceneItemTaskAccordion,
  MacroObsLockSceneItemTaskAccordion,
  MacroObsMuteInputTaskAccordion,
  MacroObsPauseRecordTaskAccordion,
  MacroObsReloadBrowserSourcesTaskAccordion,
  MacroObsResumeRecordTaskAccordion,
  MacroObsSaveReplayBufferTaskAccordion,
  MacroObsSetInputVolumeTaskAccordion,
  MacroObsSetProfileTaskAccordion,
  MacroObsSetSceneCollectionTaskAccordion,
  MacroObsShowSceneItemTaskAccordion,
  MacroObsStartRecordTaskAccordion,
  MacroObsStartReplayBufferTaskAccordion,
  MacroObsStartStreamTaskAccordion,
  MacroObsStopRecordTaskAccordion,
  MacroObsStopReplayBufferTaskAccordion,
  MacroObsStopStreamTaskAccordion,
  MacroObsSwitchPreviewSceneTaskAccordion,
  MacroObsSwitchSceneTaskAccordion,
  MacroObsToggleInputMuteTaskAccordion,
  MacroObsToggleRecordTaskAccordion,
  MacroObsToggleSceneItemTaskAccordion,
  MacroObsToggleStreamTaskAccordion,
  MacroObsTransformSceneItemTaskAccordion,
  MacroObsTriggerHotkeyTaskAccordion,
  MacroObsUnlockSceneItemTaskAccordion,
  MacroObsUnmuteInputTaskAccordion
} from '@/components/accordions/macro/obs'
import MacroTimerTaskAccordion from "@/components/accordions/macro/MacroTimerTaskAccordion.vue";
import MacroWledCustomTaskAccordion from '@/components/accordions/macro/MacroWledCustomTaskAccordion.vue'
import MacroWledOffTaskAccordion from '@/components/accordions/macro/MacroWledOffTaskAccordion.vue'
import MacroAutoMacroStartTaskAccordion from '@/components/accordions/macro/MacroAutoMacroStartTaskAccordion.vue'
import MacroAutoMacroStopTaskAccordion from '@/components/accordions/macro/MacroAutoMacroStopTaskAccordion.vue'
import MacroRotateSceneStartTaskAccordion from '@/components/accordions/macro/MacroRotateSceneStartTaskAccordion.vue'
import MacroRotateSceneStopTaskAccordion from '@/components/accordions/macro/MacroRotateSceneStopTaskAccordion.vue'
import MacroTwitchClipTaskAccordion from '@/components/accordions/macro/twitch/MacroTwitchClipTaskAccordion.vue'
import MacroTwitchShoutoutTaskAccordion from '@/components/accordions/macro/twitch/MacroTwitchShoutoutTaskAccordion.vue'
import MacroTwitchCategoryTaskAccordion from '@/components/accordions/macro/twitch/MacroTwitchCategoryTaskAccordion.vue'
import MacroTwitchPollCreateTaskAccordion from '@/components/accordions/macro/twitch/MacroTwitchPollCreateTaskAccordion.vue'
import MacroTwitchPollArchiveTaskAccordion from '@/components/accordions/macro/twitch/MacroTwitchPollArchiveTaskAccordion.vue'
import MacroTwitchPollTerminateTaskAccordion from '@/components/accordions/macro/twitch/MacroTwitchPollTerminateTaskAccordion.vue'
import MacroTwitchPredictionCreateTaskAccordion from '@/components/accordions/macro/twitch/MacroTwitchPredictionCreateTaskAccordion.vue'
import MacroTwitchPredictionLockTaskAccordion from '@/components/accordions/macro/twitch/MacroTwitchPredictionLockTaskAccordion.vue'
import MacroTwitchPredictionResolveTaskAccordion from '@/components/accordions/macro/twitch/MacroTwitchPredictionResolveTaskAccordion.vue'
import MacroTwitchPredictionCancelTaskAccordion from '@/components/accordions/macro/twitch/MacroTwitchPredictionCancelTaskAccordion.vue'
import MacroTwitchStreamMarkerTaskAccordion from '@/components/accordions/macro/twitch/MacroTwitchStreamMarkerTaskAccordion.vue'
import MacroTwitchVipAddTaskAccordion from '@/components/accordions/macro/twitch/MacroTwitchVipAddTaskAccordion.vue'
import MacroTwitchVipRemoveTaskAccordion from '@/components/accordions/macro/twitch/MacroTwitchVipRemoveTaskAccordion.vue'
import MacroTwitchAdTaskAccordion from '@/components/accordions/macro/twitch/MacroTwitchAdTaskAccordion.vue'
import MacroTwitchBanTaskAccordion from '@/components/accordions/macro/twitch/MacroTwitchBanTaskAccordion.vue'
import MacroTwitchTimeoutTaskAccordion from '@/components/accordions/macro/twitch/MacroTwitchTimeoutTaskAccordion.vue'
import MacroMusicPlayTaskAccordion from '@/components/accordions/macro/music/MacroMusicPlayTaskAccordion.vue'
import MacroMusicPauseTaskAccordion from '@/components/accordions/macro/music/MacroMusicPauseTaskAccordion.vue'
import MacroMusicTogglePauseTaskAccordion from '@/components/accordions/macro/music/MacroMusicTogglePauseTaskAccordion.vue'
import MacroMusicPreviousTaskAccordion from '@/components/accordions/macro/music/MacroMusicPreviousTaskAccordion.vue'
import MacroMusicNextTaskAccordion from '@/components/accordions/macro/music/MacroMusicNextTaskAccordion.vue'
import MacroMusicStopTaskAccordion from '@/components/accordions/macro/music/MacroMusicStopTaskAccordion.vue'
import MacroMusicShuffleTaskAccordion from '@/components/accordions/macro/music/MacroMusicShuffleTaskAccordion.vue'
import MacroMusicLoopTaskAccordion from '@/components/accordions/macro/music/MacroMusicLoopTaskAccordion.vue'
import MacroMusicLoopFileTaskAccordion from '@/components/accordions/macro/music/MacroMusicLoopFileTaskAccordion.vue'
import MacroMusicPlaySongTaskAccordion from '@/components/accordions/macro/music/MacroMusicPlaySongTaskAccordion.vue'
import MacroMusicReloadTaskAccordion from '@/components/accordions/macro/music/MacroMusicReloadTaskAccordion.vue'
import MacroMusicSongRequestTaskAccordion from '@/components/accordions/macro/music/MacroMusicSongRequestTaskAccordion.vue'
import MacroMusicToggleSongRequestsTaskAccordion from '@/components/accordions/macro/music/MacroMusicToggleSongRequestsTaskAccordion.vue'
import MacroAudioSetVolumeTaskAccordion from '@/components/accordions/macro/audio/MacroAudioSetVolumeTaskAccordion.vue'
import MacroAudioAdjustVolumeTaskAccordion from '@/components/accordions/macro/audio/MacroAudioAdjustVolumeTaskAccordion.vue'
import MacroApiGetTaskAccordion from '@/components/accordions/macro/api/MacroApiGetTaskAccordion.vue'
import MacroApiPostTaskAccordion from '@/components/accordions/macro/api/MacroApiPostTaskAccordion.vue'
import MacroApiPutTaskAccordion from '@/components/accordions/macro/api/MacroApiPutTaskAccordion.vue'
import MacroApiPatchTaskAccordion from '@/components/accordions/macro/api/MacroApiPatchTaskAccordion.vue'
import MacroApiDeleteTaskAccordion from '@/components/accordions/macro/api/MacroApiDeleteTaskAccordion.vue'

import MacroYoloboxVideoSourceTaskAccordion from '@/components/accordions/macro/yolobox/MacroYoloboxVideoSourceTaskAccordion.vue'
import MacroYoloboxOverlayTaskAccordion from '@/components/accordions/macro/yolobox/MacroYoloboxOverlayTaskAccordion.vue'
import MacroYoloboxLiveStatusTaskAccordion from '@/components/accordions/macro/yolobox/MacroYoloboxLiveStatusTaskAccordion.vue'
import MacroYoloboxAudioVolumeTaskAccordion from '@/components/accordions/macro/yolobox/MacroYoloboxAudioVolumeTaskAccordion.vue'
import MacroYoloboxAudioMuteTaskAccordion from '@/components/accordions/macro/yolobox/MacroYoloboxAudioMuteTaskAccordion.vue'
import MacroYoloboxAudioDelayTaskAccordion from '@/components/accordions/macro/yolobox/MacroYoloboxAudioDelayTaskAccordion.vue'
import MacroYoloboxAudioAfvTaskAccordion from '@/components/accordions/macro/yolobox/MacroYoloboxAudioAfvTaskAccordion.vue'

export default {
  name: 'MacroTaskList',

  provide() {
    return {
      MacroTaskListComponent: this.$options,
    }
  },

  components: {
    MacroYoloboxVideoSourceTaskAccordion,
    MacroYoloboxOverlayTaskAccordion,
    MacroYoloboxLiveStatusTaskAccordion,
    MacroYoloboxAudioVolumeTaskAccordion,
    MacroYoloboxAudioMuteTaskAccordion,
    MacroYoloboxAudioDelayTaskAccordion,
    MacroYoloboxAudioAfvTaskAccordion,
    MacroTaskAccordion,
    MacroConditionTaskAccordion,
    MacroAlertTaskAccordion,
    MacroDummyAlertTaskAccordion,
    MacroFunctionTaskAccordion,
    MacroWebsocketTaskAccordion,
    MacroObsTaskAccordion,
    MacroMacroTaskAccordion,
    MacroFileTaskAccordion,
    MacroLoopControlTaskAccordion,
    MacroLoopTaskAccordion,
    MacroMediaTaskAccordion,
    MacroWebhookTaskAccordion,
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
    MacroTimerTaskAccordion,
    MacroWledCustomTaskAccordion,
    MacroWledOffTaskAccordion,
    MacroAutoMacroStartTaskAccordion,
    MacroAutoMacroStopTaskAccordion,
    MacroRotateSceneStartTaskAccordion,
    MacroRotateSceneStopTaskAccordion,
    MacroTwitchClipTaskAccordion,
    MacroTwitchShoutoutTaskAccordion,
    MacroTwitchCategoryTaskAccordion,
    MacroTwitchPollCreateTaskAccordion,
    MacroTwitchPollArchiveTaskAccordion,
    MacroTwitchPollTerminateTaskAccordion,
    MacroTwitchPredictionCreateTaskAccordion,
    MacroTwitchPredictionLockTaskAccordion,
    MacroTwitchPredictionResolveTaskAccordion,
    MacroTwitchPredictionCancelTaskAccordion,
    MacroTwitchStreamMarkerTaskAccordion,
    MacroTwitchVipAddTaskAccordion,
    MacroTwitchVipRemoveTaskAccordion,
    MacroTwitchAdTaskAccordion,
    MacroTwitchBanTaskAccordion,
    MacroTwitchTimeoutTaskAccordion,
    MacroMusicPlayTaskAccordion,
    MacroMusicPauseTaskAccordion,
    MacroMusicTogglePauseTaskAccordion,
    MacroMusicPreviousTaskAccordion,
    MacroMusicNextTaskAccordion,
    MacroMusicStopTaskAccordion,
    MacroMusicShuffleTaskAccordion,
    MacroMusicLoopTaskAccordion,
    MacroMusicLoopFileTaskAccordion,
    MacroMusicPlaySongTaskAccordion,
    MacroMusicReloadTaskAccordion,
    MacroMusicSongRequestTaskAccordion,
    MacroMusicToggleSongRequestsTaskAccordion,
    MacroAudioSetVolumeTaskAccordion,
    MacroAudioAdjustVolumeTaskAccordion,
    MacroApiGetTaskAccordion,
    MacroApiPostTaskAccordion,
    MacroApiPutTaskAccordion,
    MacroApiPatchTaskAccordion,
    MacroApiDeleteTaskAccordion,
    MacroObsDisableSourceFilterTaskAccordion,
    MacroObsEnableSourceFilterTaskAccordion,
    MacroObsHideSceneItemTaskAccordion,
    MacroObsLockSceneItemTaskAccordion,
    MacroObsMuteInputTaskAccordion,
    MacroObsPauseRecordTaskAccordion,
    MacroObsReloadBrowserSourcesTaskAccordion,
    MacroObsResumeRecordTaskAccordion,
    MacroObsSaveReplayBufferTaskAccordion,
    MacroObsSetInputVolumeTaskAccordion,
    MacroObsSetProfileTaskAccordion,
    MacroObsSetSceneCollectionTaskAccordion,
    MacroObsShowSceneItemTaskAccordion,
    MacroObsStartRecordTaskAccordion,
    MacroObsStartReplayBufferTaskAccordion,
    MacroObsStartStreamTaskAccordion,
    MacroObsStopRecordTaskAccordion,
    MacroObsStopReplayBufferTaskAccordion,
    MacroObsStopStreamTaskAccordion,
    MacroObsSwitchPreviewSceneTaskAccordion,
    MacroObsSwitchSceneTaskAccordion,
    MacroObsToggleInputMuteTaskAccordion,
    MacroObsToggleRecordTaskAccordion,
    MacroObsToggleSceneItemTaskAccordion,
    MacroObsToggleStreamTaskAccordion,
    MacroObsTransformSceneItemTaskAccordion,
    MacroObsTriggerHotkeyTaskAccordion,
    MacroObsUnlockSceneItemTaskAccordion,
    MacroObsUnmuteInputTaskAccordion,
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
    ...mapState(useAppStore, ['getIntegrations']),

    currentTaskListComponent(): any {
      return this.taskListComponent || this.$options
    },

    hasYoloboxEnabled(): boolean {
      const integrations = this.getIntegrations || {}

      return Boolean(integrations.yolobox?.enabled)
    },

    availablePresets(): any[] {
      const presets = this.filterPresets(this.presets)

      if (this.hasYoloboxEnabled) {
        return presets
      }

      return presets.filter((preset: any) => preset.title !== 'YoloBox')
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
              title: 'Start auto macro',
              icon: 'mdi-play-circle-outline',
              factory: () => this.createTask({ channel: 'auto_macro', method: 'start', data: { name: '' } }),
            },
            {
              title: 'Stop auto macro',
              icon: 'mdi-stop-circle-outline',
              factory: () => this.createTask({ channel: 'auto_macro', method: 'stop', data: { name: '' } }),
            },
            {
              title: 'Start scene rotation',
              icon: 'mdi-play-circle-outline',
              factory: () => this.createTask({ channel: 'rotate_scene', method: 'start', data: { name: '' } }),
            },
            {
              title: 'Stop scene rotation',
              icon: 'mdi-stop-circle-outline',
              factory: () => this.createTask({ channel: 'rotate_scene', method: 'stop', data: { name: '' } }),
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
          title: 'Media',
          icon: 'mdi-multimedia',
          factory: () => this.createTask({
            channel: 'media',
            method: 'show_media',
            data: {
              target: 'default',
              path: '',
              type: null,
              clearOnEmpty: true,
              autoplay: true,
              loop: false,
              muted: false,
              controls: false,
            },
          }),
        },

        {
          title: 'Message',
          icon: 'mdi-forum-outline',
          children: [
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
              title: 'Announce',
              icon: 'mdi-bullhorn-outline',
              factory: () => this.createTask({
                channel: 'function',
                method: 'announce',
                data: {
                  content: '',
                  color: 'primary',
                },
              }),
            },
          ]
        },
        {
          title: 'Time',
          icon: 'mdi-clock-time-eight',
          children: [
            {
              title: 'Sleep 1s',
              icon: 'mdi-timer-sand',
              factory: () => this.createTask({ channel: 'function', method: 'sleep', data: { time: 1000 } }),
            },
            {
              title: 'Sleep 1min',
              icon: 'mdi-timer-sand',
              factory: () => this.createTask({ channel: 'function', method: 'sleep', data: { time: 60000 } }),
            },
            {
              title: 'Sleep 5min',
              icon: 'mdi-timer-sand',
              factory: () => this.createTask({ channel: 'function', method: 'sleep', data: { time: 300000 } }),
            },
            {
              title: 'Timer',
              icon: 'mdi-timer-play',
              factory: () => this.createTask({ channel: 'timer', method: '', data: { } }),
            },
          ]
        },
        {
          title: 'Random',
          icon: 'mdi-dice-multiple-outline',
          factory: () => this.createTask({ channel: 'function', method: 'random', data: { key: '', min: 0, max: 100 } }),
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
              title: 'Volume control',
              icon: 'mdi-volume-high',
              children: [
                {
                  title: 'Set volume',
                  icon: 'mdi-volume-high',
                  factory: () => this.createTask({
                    channel: 'audio',
                    method: 'set_volume',
                    data: { interface: '', volume: 50 },
                  }),
                },
                {
                  title: 'Adjust volume',
                  icon: 'mdi-volume-plus',
                  factory: () => this.createTask({
                    channel: 'audio',
                    method: 'adjust_volume',
                    data: { interface: '', volume: 10 },
                  }),
                },
              ],
            },
            {
              title: 'Music control',
              icon: 'mdi-music',
              children: [
                { title: 'Play', icon: 'mdi-play', factory: () => this.createTask({ channel: 'music', method: 'play', data: {} }) },
                { title: 'Pause', icon: 'mdi-pause', factory: () => this.createTask({ channel: 'music', method: 'pause', data: {} }) },
                { title: 'Toggle play / pause', icon: 'mdi-play-pause', factory: () => this.createTask({ channel: 'music', method: 'toggle_pause', data: {} }) },
                { title: 'Previous song', icon: 'mdi-skip-previous', factory: () => this.createTask({ channel: 'music', method: 'back', data: {} }) },
                { title: 'Next song', icon: 'mdi-skip-next', factory: () => this.createTask({ channel: 'music', method: 'next', data: {} }) },
                { title: 'Stop', icon: 'mdi-stop', factory: () => this.createTask({ channel: 'music', method: 'stop', data: {} }) },
                { title: 'Shuffle', icon: 'mdi-shuffle-variant', factory: () => this.createTask({ channel: 'music', method: 'shuffle', data: {} }) },
                { title: 'Loop playlist', icon: 'mdi-repeat', factory: () => this.createTask({ channel: 'music', method: 'loop', data: {} }) },
                { title: 'Loop current song', icon: 'mdi-repeat-once', factory: () => this.createTask({ channel: 'music', method: 'loop_file', data: {} }) },
                { title: 'Play specific song', icon: 'mdi-music-note', factory: () => this.createTask({ channel: 'music', method: 'play_song', data: { song: '', continue: true, restart: true, pause: false } }) },
                { title: 'Reload player', icon: 'mdi-refresh', factory: () => this.createTask({ channel: 'music', method: 'reload', data: { restore_state: false } }) },
              ],
            },
            {
              title: 'Song Request control',
              icon: 'mdi-music-note-plus',
              children: [
                { title: 'Add song request', icon: 'mdi-music-note-plus', factory: () => this.createTask({ channel: 'music', method: 'song_request', data: { url: '' } }) },
                { title: 'Toggle song requests', icon: 'mdi-music-note-off-outline', factory: () => this.createTask({ channel: 'music', method: 'song_request_toggle', data: {} }) },
              ]
            }
          ],
        },
        {
          title: 'Twitch',
          icon: 'mdi-twitch',
          children: [
            { title: 'Create clip', icon: 'mdi-content-cut', factory: () => this.createTask({ channel: 'twitch', method: 'clip', data: { create_after_delay: false, wait_seconds: 35, variable: 'clip' } }) },
            { title: 'Shoutout', icon: 'mdi-account-voice', factory: () => this.createTask({ channel: 'twitch', method: 'shoutout', data: { user: '', variable: 'shoutout' } }) },
            { title: 'Change category', icon: 'mdi-gamepad-variant-outline', factory: () => this.createTask({ channel: 'twitch', method: 'set_category', data: { category: '', variable: 'category' } }) },
            {
              title: 'Polls',
              icon: 'mdi-poll',
              children: [
                { title: 'Create poll', icon: 'mdi-plus-circle-outline', factory: () => this.createTask({ channel: 'twitch', method: 'poll', data: { action: 'create', title: '', choices: '', duration: 60, channel_points_voting: false, points_per_vote: 1, variable: 'poll' } }) },
                { title: 'Archive poll', icon: 'mdi-archive-outline', factory: () => this.createTask({ channel: 'twitch', method: 'poll', data: { action: 'archive', poll_id: '', variable: 'poll' } }) },
                { title: 'Terminate poll', icon: 'mdi-close-octagon-outline', factory: () => this.createTask({ channel: 'twitch', method: 'poll', data: { action: 'terminate', poll_id: '', variable: 'poll' } }) },
              ],
            },
            {
              title: 'Predictions',
              icon: 'mdi-crystal-ball',
              children: [
                { title: 'Create prediction', icon: 'mdi-plus-circle-outline', factory: () => this.createTask({ channel: 'twitch', method: 'prediction', data: { action: 'create', title: '', outcomes: '', duration: 120, variable: 'prediction' } }) },
                { title: 'Lock prediction', icon: 'mdi-lock-outline', factory: () => this.createTask({ channel: 'twitch', method: 'prediction', data: { action: 'lock', prediction_id: '', variable: 'prediction' } }) },
                { title: 'Resolve prediction', icon: 'mdi-check-decagram-outline', factory: () => this.createTask({ channel: 'twitch', method: 'prediction', data: { action: 'resolve', prediction_id: '', winning_outcome_id: '', variable: 'prediction' } }) },
                { title: 'Cancel prediction', icon: 'mdi-cancel', factory: () => this.createTask({ channel: 'twitch', method: 'prediction', data: { action: 'cancel', prediction_id: '', variable: 'prediction' } }) },
              ],
            },
            { title: 'Create stream marker', icon: 'mdi-map-marker-plus-outline', factory: () => this.createTask({ channel: 'twitch', method: 'stream_marker', data: { description: '', variable: 'stream_marker' } }) },
            {
              title: 'VIP',
              icon: 'mdi-star-outline',
              children: [
                { title: 'Add VIP', icon: 'mdi-star-plus-outline', factory: () => this.createTask({ channel: 'twitch', method: 'vip', data: { action: 'add', user: '' } }) },
                { title: 'Remove VIP', icon: 'mdi-star-minus-outline', factory: () => this.createTask({ channel: 'twitch', method: 'vip', data: { action: 'remove', user: '' } }) },
              ],
            },
            {
              title: 'Moderation',
              icon: 'mdi-shield-account-outline',
              children: [
                { title: 'Ban user', icon: 'mdi-account-cancel', factory: () => this.createTask({ channel: 'twitch', method: 'ban', data: { user: '', reason: '' } }) },
                { title: 'Timeout user', icon: 'mdi-account-clock', factory: () => this.createTask({ channel: 'twitch', method: 'timeout', data: { user: '', duration: 600, reason: '' } }) },
              ],
            },
            { title: 'Run ad', icon: 'mdi-advertisements', factory: () => this.createTask({ channel: 'twitch', method: 'ad', data: { duration: 30, variable: 'ad' } }) },
          ],
        },
        {
          title: 'YoloBox',
          icon: 'mdi-video-wireless-outline',
          children: [
            {
              title: 'Switch video source',
              icon: 'mdi-video-switch',
              factory: () => this.createTask({
                channel: 'yolobox',
                method: 'switch_video_source',
                data: { id: '' },
              }),
            },
            {
              title: 'Overlays',
              icon: 'mdi-layers-outline',
              children: [
                {
                  title: 'Enable overlay',
                  icon: 'mdi-eye-outline',
                  factory: () => this.createTask({
                    channel: 'yolobox',
                    method: 'set_overlay',
                    data: { id: '', isSelected: true },
                  }),
                },
                {
                  title: 'Disable overlay',
                  icon: 'mdi-eye-off-outline',
                  factory: () => this.createTask({
                    channel: 'yolobox',
                    method: 'set_overlay',
                    data: { id: '', isSelected: false },
                  }),
                },
                {
                  title: 'Disable all overlays',
                  icon: 'mdi-layers-off-outline',
                  factory: () => this.createTask({
                    channel: 'yolobox',
                    method: 'set_overlay',
                    data: { id: 'all', isSelected: false },
                  }),
                },
              ],
            },
            {
              title: 'Audio source',
              icon: 'mdi-tune-vertical',
              children: [
                {
                  title: 'Set volume',
                  icon: 'mdi-volume-high',
                  factory: () => this.createTask({
                    channel: 'yolobox',
                    method: 'set_audio_volume',
                    data: { id: '', volume: 1 },
                  }),
                },
                {
                  title: 'Mute',
                  icon: 'mdi-volume-off',
                  factory: () => this.createTask({
                    channel: 'yolobox',
                    method: 'set_audio_muted',
                    data: { id: '', muted: true },
                  }),
                },
                {
                  title: 'Unmute',
                  icon: 'mdi-volume-high',
                  factory: () => this.createTask({
                    channel: 'yolobox',
                    method: 'set_audio_muted',
                    data: { id: '', muted: false },
                  }),
                },
                {
                  title: 'Set delay',
                  icon: 'mdi-timer-outline',
                  factory: () => this.createTask({
                    channel: 'yolobox',
                    method: 'set_audio_delay',
                    data: { id: '', delayTime: 0 },
                  }),
                },
                {
                  title: 'Enable AFV',
                  icon: 'mdi-link-variant',
                  factory: () => this.createTask({
                    channel: 'yolobox',
                    method: 'set_audio_afv',
                    data: { id: '', AFV: true },
                  }),
                },
                {
                  title: 'Disable AFV',
                  icon: 'mdi-link-variant-off',
                  factory: () => this.createTask({
                    channel: 'yolobox',
                    method: 'set_audio_afv',
                    data: { id: '', AFV: false },
                  }),
                },
              ],
            },
            {
              title: 'Streaming',
              icon: 'mdi-broadcast',
              children: [
                {
                  title: 'Go live',
                  icon: 'mdi-play-circle-outline',
                  factory: () => this.createTask({
                    channel: 'yolobox',
                    method: 'set_live_status',
                    data: { status: 'start' },
                  }),
                },
                {
                  title: 'Stop stream',
                  icon: 'mdi-stop-circle-outline',
                  factory: () => this.createTask({
                    channel: 'yolobox',
                    method: 'set_live_status',
                    data: { status: 'stop' },
                  }),
                },
              ],
            },
          ],
        },
        {
          title: 'OBS',
          icon: 'mdi-broadcast',
          children: [
            {
              title: 'Scenes',
              icon: 'mdi-monitor-screenshot',
              children: [
                { title: 'Switch scene', icon: 'mdi-monitor-screenshot', factory: () => this.createTask({ channel: 'obs', method: 'SetCurrentProgramScene', data: { sceneName: '' } }) },
                { title: 'Switch preview scene', icon: 'mdi-monitor-eye', factory: () => this.createTask({ channel: 'obs', method: 'SetCurrentPreviewScene', data: { sceneName: '' } }) },
              ],
            },
            {
              title: 'Scene items',
              icon: 'mdi-layers-outline',
              children: [
                { title: 'Show scene item', icon: 'mdi-eye', factory: () => this.createTask({ channel: 'obs', method: 'SetSceneItemEnabled', data: { sceneName: '', sceneItemId: null, sceneItemEnabled: true } }) },
                { title: 'Hide scene item', icon: 'mdi-eye-off', factory: () => this.createTask({ channel: 'obs', method: 'SetSceneItemEnabled', data: { sceneName: '', sceneItemId: null, sceneItemEnabled: false } }) },
                { title: 'Lock scene item', icon: 'mdi-lock', factory: () => this.createTask({ channel: 'obs', method: 'SetSceneItemLocked', data: { sceneName: '', sceneItemId: null, sceneItemLocked: true } }) },
                { title: 'Unlock scene item', icon: 'mdi-lock-open-variant', factory: () => this.createTask({ channel: 'obs', method: 'SetSceneItemLocked', data: { sceneName: '', sceneItemId: null, sceneItemLocked: false } }) },
                { title: 'Transform scene item', icon: 'mdi-vector-square', factory: () => this.createTask({ channel: 'obs', method: 'SetSceneItemTransform', data: { sceneName: '', sceneItemId: null, sceneItemTransform: { positionX: 0, positionY: 0, scaleX: 1, scaleY: 1, rotation: 0 } } }) },
              ],
            },
            {
              title: 'Audio',
              icon: 'mdi-volume-high',
              children: [
                { title: 'Mute input', icon: 'mdi-volume-off', factory: () => this.createTask({ channel: 'obs', method: 'SetInputMute', data: { inputName: '', inputMuted: true } }) },
                { title: 'Unmute input', icon: 'mdi-volume-high', factory: () => this.createTask({ channel: 'obs', method: 'SetInputMute', data: { inputName: '', inputMuted: false } }) },
                { title: 'Toggle input mute', icon: 'mdi-volume-medium', factory: () => this.createTask({ channel: 'obs', method: 'ToggleInputMute', data: { inputName: '' } }) },
                { title: 'Set input volume', icon: 'mdi-volume-source', factory: () => this.createTask({ channel: 'obs', method: 'SetInputVolume', data: { inputName: '', inputVolumeDb: 0 } }) },
              ],
            },
            {
              title: 'Filters',
              icon: 'mdi-filter',
              children: [
                { title: 'Enable source filter', icon: 'mdi-filter-check', factory: () => this.createTask({ channel: 'obs', method: 'SetSourceFilterEnabled', data: { sourceName: '', filterName: '', filterEnabled: true } }) },
                { title: 'Disable source filter', icon: 'mdi-filter-off', factory: () => this.createTask({ channel: 'obs', method: 'SetSourceFilterEnabled', data: { sourceName: '', filterName: '', filterEnabled: false } }) },
              ],
            },
            {
              title: 'Streaming',
              icon: 'mdi-broadcast',
              children: [
                { title: 'Start stream', icon: 'mdi-broadcast', factory: () => this.createTask({ channel: 'obs', method: 'StartStream', data: {} }) },
                { title: 'Stop stream', icon: 'mdi-broadcast-off', factory: () => this.createTask({ channel: 'obs', method: 'StopStream', data: {} }) },
                { title: 'Toggle stream', icon: 'mdi-broadcast', factory: () => this.createTask({ channel: 'obs', method: 'ToggleStream', data: {} }) },
              ],
            },
            {
              title: 'Recording',
              icon: 'mdi-record-rec',
              children: [
                { title: 'Start recording', icon: 'mdi-record-rec', factory: () => this.createTask({ channel: 'obs', method: 'StartRecord', data: {} }) },
                { title: 'Stop recording', icon: 'mdi-stop-circle', factory: () => this.createTask({ channel: 'obs', method: 'StopRecord', data: {} }) },
                { title: 'Toggle recording', icon: 'mdi-record-circle-outline', factory: () => this.createTask({ channel: 'obs', method: 'ToggleRecord', data: {} }) },
                { title: 'Pause recording', icon: 'mdi-pause-circle', factory: () => this.createTask({ channel: 'obs', method: 'PauseRecord', data: {} }) },
                { title: 'Resume recording', icon: 'mdi-play-circle', factory: () => this.createTask({ channel: 'obs', method: 'ResumeRecord', data: {} }) },
              ],
            },
            {
              title: 'Replay buffer',
              icon: 'mdi-history',
              children: [
                { title: 'Start replay buffer', icon: 'mdi-history', factory: () => this.createTask({ channel: 'obs', method: 'StartReplayBuffer', data: {} }) },
                { title: 'Stop replay buffer', icon: 'mdi-history', factory: () => this.createTask({ channel: 'obs', method: 'StopReplayBuffer', data: {} }) },
                { title: 'Save replay buffer', icon: 'mdi-content-save', factory: () => this.createTask({ channel: 'obs', method: 'SaveReplayBuffer', data: {} }) },
              ],
            },
            {
              title: 'Tools',
              icon: 'mdi-tools',
              children: [
                { title: 'Reload browser sources', icon: 'mdi-refresh', factory: () => this.createTask({ channel: 'obs', method: 'reload_browser_sources', data: {} }) },
                { title: 'Trigger hotkey', icon: 'mdi-keyboard', factory: () => this.createTask({ channel: 'obs', method: 'TriggerHotkeyByName', data: { hotkeyName: '' } }) },
                { title: 'Set profile', icon: 'mdi-account-cog', factory: () => this.createTask({ channel: 'obs', method: 'SetCurrentProfile', data: { profileName: '' } }) },
                { title: 'Set scene collection', icon: 'mdi-folder-cog', factory: () => this.createTask({ channel: 'obs', method: 'SetCurrentSceneCollection', data: { sceneCollectionName: '' } }) },
              ],
            },
          ],
        },

        {
          title: 'Lights',
          icon: 'mdi-led-on',
          children: [
            {
              title: 'Wled',
              icon: 'mdi-led-strip-variant',
              factory: () => this.createTask({ channel: 'wled', method: 'custom', data: { name: '', red: 255, green: 255, blue: 255, white: 0, brightness: 255, effect: 0 } }),
            },
            {
              title: 'Wled Off',
              icon: 'mdi-led-strip-variant-off',
              factory: () => this.createTask({ channel: 'wled', method: 'off', data: { name: '' } }),
            },
          ]
        },
        {
          title: 'Expert',
          icon: 'mdi-function',
          children: [
            {
              title: 'Webhook',
              icon: 'mdi-webhook',
              factory: () => this.createTask({ channel: 'webhook', method: 'post', data: {} }),
            },
            {
              title: 'Websocket',
              icon: 'mdi-connection',
              factory: () => this.createTask({ channel: 'websocket', method: '', data: {} }),
            },
            {
              title: 'API request',
              icon: 'mdi-api',
              children: [
                {
                  title: 'GET request',
                  icon: 'mdi-download',
                  factory: () => this.createApiRequestTask('get'),
                },
                {
                  title: 'POST request',
                  icon: 'mdi-upload',
                  factory: () => this.createApiRequestTask('post'),
                },
                {
                  title: 'PUT request',
                  icon: 'mdi-file-replace-outline',
                  factory: () => this.createApiRequestTask('put'),
                },
                {
                  title: 'PATCH request',
                  icon: 'mdi-file-edit-outline',
                  factory: () => this.createApiRequestTask('patch'),
                },
                {
                  title: 'DELETE request',
                  icon: 'mdi-delete-outline',
                  factory: () => this.createApiRequestTask('delete'),
                },
              ],
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
    filterPresets(presets: any[]): any[] {
      return presets
        .map((preset: any) => {
          if (preset.loopOnly === true && !this.insideLoop) return null

          if (!preset.children?.length) return preset

          const children = this.filterPresets(preset.children)
          if (!children.length) return null

          return {
            ...preset,
            children,
          }
        })
        .filter(Boolean)
    },

    componentFor(item: any) {
      if (item?.type === 'condition') return 'MacroConditionTaskAccordion'
      if (item?.type === 'loop' || (item?.task?.channel === 'loop' && item?.task?.method === 'for')) return 'MacroLoopTaskAccordion'
      if (item?.task?.channel === 'loop' && ['break', 'continue', 'end_for'].includes(item?.task?.method)) return 'MacroLoopControlTaskAccordion'
      if (item?.task?.channel === 'condition' && item?.task?.method === 'end_macro') return 'MacroEndMacroTaskAccordion'

      if (item?.task?.channel === 'timer') {
        return 'MacroTimerTaskAccordion'
      }

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

      if (item?.task?.channel === 'api_request') {
        if (item?.task?.method === 'get') return 'MacroApiGetTaskAccordion'
        if (item?.task?.method === 'post') return 'MacroApiPostTaskAccordion'
        if (item?.task?.method === 'put') return 'MacroApiPutTaskAccordion'
        if (item?.task?.method === 'patch') return 'MacroApiPatchTaskAccordion'
        if (item?.task?.method === 'delete') return 'MacroApiDeleteTaskAccordion'
      }

      if (item?.task?.channel === 'keyboard') {
        return 'MacroKeyboardTaskAccordion'
      }

      if (item?.task?.channel === 'wled' && item?.task?.method === 'custom') {
        return 'MacroWledCustomTaskAccordion'
      }

      if (item?.task?.channel === 'wled' && item?.task?.method === 'off') {
        return 'MacroWledOffTaskAccordion'
      }

      if (item?.task?.channel === 'auto_macro') {
        if (['stop', 'disable'].includes(item?.task?.method)) return 'MacroAutoMacroStopTaskAccordion'
        return 'MacroAutoMacroStartTaskAccordion'
      }

      if (item?.task?.channel === 'rotate_scene') {
        if (item?.task?.method === 'stop') return 'MacroRotateSceneStopTaskAccordion'
        return 'MacroRotateSceneStartTaskAccordion'
      }

      if (item?.task?.channel === 'twitch') {
        if (item?.task?.method === 'clip') return 'MacroTwitchClipTaskAccordion'
        if (item?.task?.method === 'shoutout') return 'MacroTwitchShoutoutTaskAccordion'
        if (item?.task?.method === 'set_category') return 'MacroTwitchCategoryTaskAccordion'
        if (item?.task?.method === 'poll') {
          if (item?.task?.data?.action === 'archive') return 'MacroTwitchPollArchiveTaskAccordion'
          if (item?.task?.data?.action === 'terminate') return 'MacroTwitchPollTerminateTaskAccordion'
          return 'MacroTwitchPollCreateTaskAccordion'
        }
        if (item?.task?.method === 'prediction') {
          if (item?.task?.data?.action === 'lock') return 'MacroTwitchPredictionLockTaskAccordion'
          if (item?.task?.data?.action === 'resolve') return 'MacroTwitchPredictionResolveTaskAccordion'
          if (item?.task?.data?.action === 'cancel') return 'MacroTwitchPredictionCancelTaskAccordion'
          return 'MacroTwitchPredictionCreateTaskAccordion'
        }
        if (item?.task?.method === 'stream_marker') return 'MacroTwitchStreamMarkerTaskAccordion'
        if (item?.task?.method === 'vip') {
          if (item?.task?.data?.action === 'remove') return 'MacroTwitchVipRemoveTaskAccordion'
          return 'MacroTwitchVipAddTaskAccordion'
        }
        if (item?.task?.method === 'ban') return 'MacroTwitchBanTaskAccordion'
        if (item?.task?.method === 'timeout') return 'MacroTwitchTimeoutTaskAccordion'
        if (item?.task?.method === 'ad') return 'MacroTwitchAdTaskAccordion'
      }

      if (item?.task?.channel === 'yolobox') {
        if (item.task.method === 'switch_video_source') return 'MacroYoloboxVideoSourceTaskAccordion'
        if (item.task.method === 'set_overlay') return 'MacroYoloboxOverlayTaskAccordion'
        if (item.task.method === 'set_audio_volume') return 'MacroYoloboxAudioVolumeTaskAccordion'
        if (item.task.method === 'set_audio_muted') return 'MacroYoloboxAudioMuteTaskAccordion'
        if (item.task.method === 'set_audio_delay') return 'MacroYoloboxAudioDelayTaskAccordion'
        if (item.task.method === 'set_audio_afv') return 'MacroYoloboxAudioAfvTaskAccordion'
        if (item.task.method === 'set_live_status') return 'MacroYoloboxLiveStatusTaskAccordion'
      }

      if (item?.task?.channel === 'obs') {
        const data = item?.task?.data ?? {}

        if (item?.task?.method === 'SetCurrentProgramScene') return 'MacroObsSwitchSceneTaskAccordion'
        if (item?.task?.method === 'SetCurrentPreviewScene') return 'MacroObsSwitchPreviewSceneTaskAccordion'

        if (item?.task?.method === 'SetSceneItemEnabled') {
          if (data.sceneItemEnabled === false) return 'MacroObsHideSceneItemTaskAccordion'
          if (data.sceneItemEnabled === true) return 'MacroObsShowSceneItemTaskAccordion'
          return 'MacroObsToggleSceneItemTaskAccordion'
        }

        if (item?.task?.method === 'SetSceneItemLocked') {
          if (data.sceneItemLocked === false) return 'MacroObsUnlockSceneItemTaskAccordion'
          return 'MacroObsLockSceneItemTaskAccordion'
        }

        if (item?.task?.method === 'SetSceneItemTransform') return 'MacroObsTransformSceneItemTaskAccordion'
        if (item?.task?.method === 'SetInputMute') return data.inputMuted === false ? 'MacroObsUnmuteInputTaskAccordion' : 'MacroObsMuteInputTaskAccordion'
        if (item?.task?.method === 'ToggleInputMute') return 'MacroObsToggleInputMuteTaskAccordion'
        if (item?.task?.method === 'SetInputVolume') return 'MacroObsSetInputVolumeTaskAccordion'

        if (item?.task?.method === 'SetSourceFilterEnabled') {
          if (data.filterEnabled === false) return 'MacroObsDisableSourceFilterTaskAccordion'
          return 'MacroObsEnableSourceFilterTaskAccordion'
        }

        if (item?.task?.method === 'StartStream') return 'MacroObsStartStreamTaskAccordion'
        if (item?.task?.method === 'StopStream') return 'MacroObsStopStreamTaskAccordion'
        if (item?.task?.method === 'ToggleStream') return 'MacroObsToggleStreamTaskAccordion'
        if (item?.task?.method === 'StartRecord') return 'MacroObsStartRecordTaskAccordion'
        if (item?.task?.method === 'StopRecord') return 'MacroObsStopRecordTaskAccordion'
        if (item?.task?.method === 'ToggleRecord') return 'MacroObsToggleRecordTaskAccordion'
        if (item?.task?.method === 'PauseRecord') return 'MacroObsPauseRecordTaskAccordion'
        if (item?.task?.method === 'ResumeRecord') return 'MacroObsResumeRecordTaskAccordion'
        if (item?.task?.method === 'StartReplayBuffer') return 'MacroObsStartReplayBufferTaskAccordion'
        if (item?.task?.method === 'StopReplayBuffer') return 'MacroObsStopReplayBufferTaskAccordion'
        if (item?.task?.method === 'SaveReplayBuffer') return 'MacroObsSaveReplayBufferTaskAccordion'
        if (item?.task?.method === 'reload_browser_sources') return 'MacroObsReloadBrowserSourcesTaskAccordion'
        if (item?.task?.method === 'TriggerHotkeyByName') return 'MacroObsTriggerHotkeyTaskAccordion'
        if (item?.task?.method === 'SetCurrentProfile') return 'MacroObsSetProfileTaskAccordion'
        if (item?.task?.method === 'SetCurrentSceneCollection') return 'MacroObsSetSceneCollectionTaskAccordion'
      }

      if (item?.task?.channel === 'audio') {
        const audioComponentsByMethod: Record<string, string> = {
          set_volume: 'MacroAudioSetVolumeTaskAccordion',
          adjust_volume: 'MacroAudioAdjustVolumeTaskAccordion',
          relative_volume: 'MacroAudioAdjustVolumeTaskAccordion',
        }

        return audioComponentsByMethod[item?.task?.method] ?? 'MacroTaskAccordion'
      }

      if (item?.task?.channel === 'music') {
        const musicComponentsByMethod: Record<string, string> = {
          play: 'MacroMusicPlayTaskAccordion',
          pause: 'MacroMusicPauseTaskAccordion',
          toggle_pause: 'MacroMusicTogglePauseTaskAccordion',
          back: 'MacroMusicPreviousTaskAccordion',
          previous: 'MacroMusicPreviousTaskAccordion',
          prev: 'MacroMusicPreviousTaskAccordion',
          next: 'MacroMusicNextTaskAccordion',
          stop: 'MacroMusicStopTaskAccordion',          shuffle: 'MacroMusicShuffleTaskAccordion',
          loop: 'MacroMusicLoopTaskAccordion',
          loop_playlist: 'MacroMusicLoopTaskAccordion',
          loop_file: 'MacroMusicLoopFileTaskAccordion',
          play_song: 'MacroMusicPlaySongTaskAccordion',
          song: 'MacroMusicPlaySongTaskAccordion',
          reload: 'MacroMusicReloadTaskAccordion',
          song_request: 'MacroMusicSongRequestTaskAccordion',
          song_request_toggle: 'MacroMusicToggleSongRequestsTaskAccordion',
          toggle_song_request: 'MacroMusicToggleSongRequestsTaskAccordion',
        }

        return musicComponentsByMethod[item?.task?.method] ?? 'MacroTaskAccordion'
      }

      const componentsByChannel: Record<string, string> = {
        alert: 'MacroAlertTaskAccordion',
        dummy_alert: 'MacroDummyAlertTaskAccordion',
        function: 'MacroFunctionTaskAccordion',
        websocket: 'MacroWebsocketTaskAccordion',
        macro: 'MacroMacroTaskAccordion',
        file: 'MacroFileTaskAccordion',
        media: 'MacroMediaTaskAccordion',
        webhook: 'MacroWebhookTaskAccordion',
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

    createApiRequestTask(method: 'get' | 'post' | 'put' | 'patch' | 'delete') {
      const supportsBody = method !== 'get'

      return this.createTask({
        channel: 'api_request',
        method,
        data: {
          url: '',
          result_variable: 'api_response',
          headers: {},
          query: {},
          timeout: 30000,
          fail_on_error: false,
          ...(supportsBody
            ? {
              body_type: 'json',
              body_data: {},
              form_data: {},
            }
            : {}),
        },
      })
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
