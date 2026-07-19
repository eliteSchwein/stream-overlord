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
      :text="$t('components.macroTaskList.noTasksYet')"
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
        {{ $t('components.macroTaskList.addTask') }}
      </v-btn>
      </template>

      <v-list density="comfortable">
        <template v-for="preset in availablePresets" :key="preset.titleKey || preset.title">
          <v-list-group v-if="preset.children?.length" :value="preset.titleKey || preset.title">
            <template #activator="{ props: groupProps }">
              <v-list-item
                v-bind="groupProps"
                :prepend-icon="preset.icon"
                :title="presetTitle(preset)"
                @click.stop
              />
            </template>

            <template v-for="child in preset.children" :key="child.titleKey || child.title">
              <v-list-group v-if="child.children?.length" :value="`${preset.titleKey || preset.title}:${child.titleKey || child.title}`">
                <template #activator="{ props: childGroupProps }">
                  <v-list-item
                    v-bind="childGroupProps"
                    :prepend-icon="child.icon"
                    :title="presetTitle(child)"
                    @click.stop
                  />
                </template>

                <v-list-item
                  v-for="grandChild in child.children"
                  :key="grandChild.titleKey || grandChild.title"
                  :prepend-icon="grandChild.icon"
                  :title="presetTitle(grandChild)"
                  @click.stop="addTaskAndClose(grandChild.factory())"
                />
              </v-list-group>

              <v-list-item
                v-else
                :prepend-icon="child.icon"
                :title="presetTitle(child)"
                @click.stop="addTaskAndClose(child.factory())"
              />
            </template>
          </v-list-group>

          <v-list-item
            v-else
            :prepend-icon="preset.icon"
            :title="presetTitle(preset)"
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
import MacroSystemRebootTaskAccordion from "@/components/accordions/macro/system/MacroSystemRebootTaskAccordion.vue";
import MacroSystemShutdownTaskAccordion
  from "@/components/accordions/macro/system/MacroSystemShutdownTaskAccordion.vue";

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
    MacroSystemRebootTaskAccordion,
    MacroSystemShutdownTaskAccordion,
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
          titleKey: 'macro.presets.conditions.title',
          icon: 'mdi-source-branch',
          children: [
            {
              titleKey: 'macro.presets.conditions.ifCondition',
              icon: 'mdi-source-branch',
              factory: () => this.createConditionTask(),
            },
            {
              titleKey: 'macro.presets.conditions.forLoop',
              icon: 'mdi-repeat',
              factory: () => this.createLoopTask(),
            },
            {
              titleKey: 'macro.presets.conditions.loopBreak',
              icon: 'mdi-stop-circle-outline',
              loopOnly: true,
              factory: () => this.createTask({ channel: 'loop', method: 'break' }),
            },
            {
              titleKey: 'macro.presets.conditions.loopContinue',
              icon: 'mdi-skip-next-outline',
              loopOnly: true,
              factory: () => this.createTask({ channel: 'loop', method: 'continue' }),
            },
          ],
        },
        {
          titleKey: 'macro.presets.macro.title',
          icon: 'mdi-star-circle',
          children: [
            {
              titleKey: 'macro.presets.macro.runMacro',
              icon: 'mdi-playlist-play',
              factory: () => this.createTask({ channel: 'macro', method: '', data: {} }),
            },
            {
              titleKey: 'macro.presets.macro.startAutoMacro',
              icon: 'mdi-play-circle-outline',
              factory: () => this.createTask({ channel: 'auto_macro', method: 'start', data: { name: '' } }),
            },
            {
              titleKey: 'macro.presets.macro.stopAutoMacro',
              icon: 'mdi-stop-circle-outline',
              factory: () => this.createTask({ channel: 'auto_macro', method: 'stop', data: { name: '' } }),
            },
            {
              titleKey: 'macro.presets.macro.startSceneRotation',
              icon: 'mdi-play-circle-outline',
              factory: () => this.createTask({ channel: 'rotate_scene', method: 'start', data: { name: '' } }),
            },
            {
              titleKey: 'macro.presets.macro.stopSceneRotation',
              icon: 'mdi-stop-circle-outline',
              factory: () => this.createTask({ channel: 'rotate_scene', method: 'stop', data: { name: '' } }),
            },
            {
              titleKey: 'macro.presets.macro.endMacro',
              icon: 'mdi-stop-circle-outline',
              factory: () => this.createTask({ channel: 'condition', method: 'end_macro' }),
            },
          ],
        },
        {
          titleKey: 'macro.presets.alert',
          icon: 'mdi-bell-ring',
          factory: () => this.createTask({ channel: 'alert', message: '', asset: '' }),
        },
        {
          titleKey: 'macro.presets.animation',
          icon: 'mdi-animation-play',
          factory: () => this.createTask({ channel: 'animation', method: 'play' }),
        },
        {
          titleKey: 'macro.presets.media',
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
          titleKey: 'macro.presets.message.title',
          icon: 'mdi-forum-outline',
          children: [
            {
              titleKey: 'macro.presets.message.sendDm',
              icon: 'mdi-message-lock-outline',
              factory: () => this.createTask({ channel: 'function', method: 'send_dm', data: { user: '', content: '' } }),
            },
            {
              titleKey: 'macro.presets.message.chatMessage',
              icon: 'mdi-message-text-outline',
              factory: () => this.createTask({ channel: 'function', method: 'send_message', data: { content: '' } }),
            },
            {
              titleKey: 'macro.presets.message.announce',
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
          titleKey: 'macro.presets.time.title',
          icon: 'mdi-clock-time-eight',
          children: [
            {
              titleKey: 'macro.presets.time.sleep1s',
              icon: 'mdi-timer-sand',
              factory: () => this.createTask({ channel: 'function', method: 'sleep', data: { time: 1000 } }),
            },
            {
              titleKey: 'macro.presets.time.sleep1min',
              icon: 'mdi-timer-sand',
              factory: () => this.createTask({ channel: 'function', method: 'sleep', data: { time: 60000 } }),
            },
            {
              titleKey: 'macro.presets.time.sleep5min',
              icon: 'mdi-timer-sand',
              factory: () => this.createTask({ channel: 'function', method: 'sleep', data: { time: 300000 } }),
            },
            {
              titleKey: 'macro.presets.time.timer',
              icon: 'mdi-timer-play',
              factory: () => this.createTask({ channel: 'timer', method: '', data: { } }),
            },
          ]
        },
        {
          titleKey: 'macro.presets.random',
          icon: 'mdi-dice-multiple-outline',
          factory: () => this.createTask({ channel: 'function', method: 'random', data: { key: '', min: 0, max: 100 } }),
        },
        {
          titleKey: 'macro.presets.fileReadAssetFolder',
          icon: 'mdi-folder-open-outline',
          factory: () => this.createTask({ channel: 'file', method: 'read_folder', data: { path: null, key: 'files', fileExtension: null } }),
        },
        {
          titleKey: 'macro.presets.channelPoint.title',
          icon: 'mdi-star-circle',
          children: [
            {
              titleKey: 'macro.presets.channelPoint.acceptReward',
              icon: 'mdi-check-circle-outline',
              factory: () => this.createTask({ channel: 'channel_point', method: 'accept' }),
            },
            {
              titleKey: 'macro.presets.channelPoint.cancelReward',
              icon: 'mdi-close-circle-outline',
              factory: () => this.createTask({ channel: 'channel_point', method: 'cancel' }),
            },
            {
              titleKey: 'macro.presets.channelPoint.pauseReward',
              icon: 'mdi-pause-circle-outline',
              factory: () => this.createTask({ channel: 'channel_point', method: 'pause', data: { name: '' } }),
            },
            {
              titleKey: 'macro.presets.channelPoint.unpauseReward',
              icon: 'mdi-play-circle-outline',
              factory: () => this.createTask({ channel: 'channel_point', method: 'unpause', data: { name: '' } }),
            },
            {
              titleKey: 'macro.presets.channelPoint.setPauseState',
              icon: 'mdi-toggle-switch-outline',
              factory: () => this.createTask({ channel: 'channel_point', method: 'toggle_pause', data: { name: '', state: 'pause' } }),
            },
            {
              titleKey: 'macro.presets.channelPoint.enableReward',
              icon: 'mdi-toggle-switch',
              factory: () => this.createTask({ channel: 'channel_point', method: 'enable', data: { name: '' } }),
            },
            {
              titleKey: 'macro.presets.channelPoint.disableReward',
              icon: 'mdi-toggle-switch-off-outline',
              factory: () => this.createTask({ channel: 'channel_point', method: 'disable', data: { name: '' } }),
            },
            {
              titleKey: 'macro.presets.channelPoint.setEnabledState',
              icon: 'mdi-toggle-switch-outline',
              factory: () => this.createTask({ channel: 'channel_point', method: 'toggle', data: { name: '', state: 'enable' } }),
            },
          ],
        },
        {

          titleKey: 'macro.presets.variables.title',
          icon: 'mdi-variable',
          children: [
            {
              titleKey: 'macro.presets.variables.setVariable',
              icon: 'mdi-database-export-outline',
              factory: () => this.createTask({ channel: 'variable', method: 'set', data: { value: null, key: '', to_file: false } }),
            },
            {
              titleKey: 'macro.presets.variables.getVariable',
              icon: 'mdi-database-import-outline',
              factory: () => this.createTask({ channel: 'variable', method: 'get', data: { key: '' } }),
            },
          ]
        },
        {
          titleKey: 'macro.presets.audio.title',
          icon: 'mdi-volume-high',
          children: [
            {
              titleKey: 'macro.presets.audio.speak',
              icon: 'mdi-account-voice',
              factory: () => this.createTask({ channel: 'function', method: 'speak', data: { content: '', event_uuid: "${eventUuid}" } }),
            },
            {
              titleKey: 'macro.presets.audio.volumeControl.title',
              icon: 'mdi-volume-high',
              children: [
                {
                  titleKey: 'macro.presets.audio.volumeControl.setVolume',
                  icon: 'mdi-volume-high',
                  factory: () => this.createTask({
                    channel: 'audio',
                    method: 'set_volume',
                    data: { interface: '', volume: 50 },
                  }),
                },
                {
                  titleKey: 'macro.presets.audio.volumeControl.adjustVolume',
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
              titleKey: 'macro.presets.audio.musicControl.title',
              icon: 'mdi-music',
              children: [
                { titleKey: 'macro.presets.audio.musicControl.play', icon: 'mdi-play', factory: () => this.createTask({ channel: 'music', method: 'play', data: {} }) },
                { titleKey: 'macro.presets.audio.musicControl.pause', icon: 'mdi-pause', factory: () => this.createTask({ channel: 'music', method: 'pause', data: {} }) },
                { titleKey: 'macro.presets.audio.musicControl.togglePlayPause', icon: 'mdi-play-pause', factory: () => this.createTask({ channel: 'music', method: 'toggle_pause', data: {} }) },
                { titleKey: 'macro.presets.audio.musicControl.previousSong', icon: 'mdi-skip-previous', factory: () => this.createTask({ channel: 'music', method: 'back', data: {} }) },
                { titleKey: 'macro.presets.audio.musicControl.nextSong', icon: 'mdi-skip-next', factory: () => this.createTask({ channel: 'music', method: 'next', data: {} }) },
                { titleKey: 'macro.presets.audio.musicControl.stop', icon: 'mdi-stop', factory: () => this.createTask({ channel: 'music', method: 'stop', data: {} }) },
                { titleKey: 'macro.presets.audio.musicControl.shuffle', icon: 'mdi-shuffle-variant', factory: () => this.createTask({ channel: 'music', method: 'shuffle', data: {} }) },
                { titleKey: 'macro.presets.audio.musicControl.loopPlaylist', icon: 'mdi-repeat', factory: () => this.createTask({ channel: 'music', method: 'loop', data: {} }) },
                { titleKey: 'macro.presets.audio.musicControl.loopCurrentSong', icon: 'mdi-repeat-once', factory: () => this.createTask({ channel: 'music', method: 'loop_file', data: {} }) },
                { titleKey: 'macro.presets.audio.musicControl.playSpecificSong', icon: 'mdi-music-note', factory: () => this.createTask({ channel: 'music', method: 'play_song', data: { song: '', continue: true, restart: true, pause: false } }) },
                { titleKey: 'macro.presets.audio.musicControl.reloadPlayer', icon: 'mdi-refresh', factory: () => this.createTask({ channel: 'music', method: 'reload', data: { restore_state: false } }) },
              ],
            },
            {
              titleKey: 'macro.presets.audio.songRequestControl.title',
              icon: 'mdi-music-note-plus',
              children: [
                { titleKey: 'macro.presets.audio.songRequestControl.addSongRequest', icon: 'mdi-music-note-plus', factory: () => this.createTask({ channel: 'music', method: 'song_request', data: { url: '' } }) },
                { titleKey: 'macro.presets.audio.songRequestControl.toggleSongRequests', icon: 'mdi-music-note-off-outline', factory: () => this.createTask({ channel: 'music', method: 'song_request_toggle', data: {} }) },
              ]
            }
          ],
        },
        {
          titleKey: 'macro.presets.twitch.title',
          icon: 'mdi-twitch',
          children: [
            { titleKey: 'macro.presets.twitch.createClip', icon: 'mdi-content-cut', factory: () => this.createTask({ channel: 'twitch', method: 'clip', data: { create_after_delay: false, wait_seconds: 35, variable: 'clip' } }) },
            { titleKey: 'macro.presets.twitch.shoutout', icon: 'mdi-account-voice', factory: () => this.createTask({ channel: 'twitch', method: 'shoutout', data: { user: '', variable: 'shoutout' } }) },
            { titleKey: 'macro.presets.twitch.changeCategory', icon: 'mdi-gamepad-variant-outline', factory: () => this.createTask({ channel: 'twitch', method: 'set_category', data: { category: '', variable: 'category' } }) },
            {
              titleKey: 'macro.presets.twitch.polls.title',
              icon: 'mdi-poll',
              children: [
                { titleKey: 'macro.presets.twitch.polls.createPoll', icon: 'mdi-plus-circle-outline', factory: () => this.createTask({ channel: 'twitch', method: 'poll', data: { action: 'create', title: '', choices: '', duration: 60, channel_points_voting: false, points_per_vote: 1, variable: 'poll' } }) },
                { titleKey: 'macro.presets.twitch.polls.archivePoll', icon: 'mdi-archive-outline', factory: () => this.createTask({ channel: 'twitch', method: 'poll', data: { action: 'archive', poll_id: '', variable: 'poll' } }) },
                { titleKey: 'macro.presets.twitch.polls.terminatePoll', icon: 'mdi-close-octagon-outline', factory: () => this.createTask({ channel: 'twitch', method: 'poll', data: { action: 'terminate', poll_id: '', variable: 'poll' } }) },
              ],
            },
            {
              titleKey: 'macro.presets.twitch.predictions.title',
              icon: 'mdi-crystal-ball',
              children: [
                { titleKey: 'macro.presets.twitch.predictions.createPrediction', icon: 'mdi-plus-circle-outline', factory: () => this.createTask({ channel: 'twitch', method: 'prediction', data: { action: 'create', title: '', outcomes: '', duration: 120, variable: 'prediction' } }) },
                { titleKey: 'macro.presets.twitch.predictions.lockPrediction', icon: 'mdi-lock-outline', factory: () => this.createTask({ channel: 'twitch', method: 'prediction', data: { action: 'lock', prediction_id: '', variable: 'prediction' } }) },
                { titleKey: 'macro.presets.twitch.predictions.resolvePrediction', icon: 'mdi-check-decagram-outline', factory: () => this.createTask({ channel: 'twitch', method: 'prediction', data: { action: 'resolve', prediction_id: '', winning_outcome_id: '', variable: 'prediction' } }) },
                { titleKey: 'macro.presets.twitch.predictions.cancelPrediction', icon: 'mdi-cancel', factory: () => this.createTask({ channel: 'twitch', method: 'prediction', data: { action: 'cancel', prediction_id: '', variable: 'prediction' } }) },
              ],
            },
            { titleKey: 'macro.presets.twitch.createStreamMarker', icon: 'mdi-map-marker-plus-outline', factory: () => this.createTask({ channel: 'twitch', method: 'stream_marker', data: { description: '', variable: 'stream_marker' } }) },
            {
              titleKey: 'macro.presets.twitch.vip.title',
              icon: 'mdi-star-outline',
              children: [
                { titleKey: 'macro.presets.twitch.vip.addVip', icon: 'mdi-star-plus-outline', factory: () => this.createTask({ channel: 'twitch', method: 'vip', data: { action: 'add', user: '' } }) },
                { titleKey: 'macro.presets.twitch.vip.removeVip', icon: 'mdi-star-minus-outline', factory: () => this.createTask({ channel: 'twitch', method: 'vip', data: { action: 'remove', user: '' } }) },
              ],
            },
            {
              titleKey: 'macro.presets.twitch.moderation.title',
              icon: 'mdi-shield-account-outline',
              children: [
                { titleKey: 'macro.presets.twitch.moderation.banUser', icon: 'mdi-account-cancel', factory: () => this.createTask({ channel: 'twitch', method: 'ban', data: { user: '', reason: '' } }) },
                { titleKey: 'macro.presets.twitch.moderation.timeoutUser', icon: 'mdi-account-clock', factory: () => this.createTask({ channel: 'twitch', method: 'timeout', data: { user: '', duration: 600, reason: '' } }) },
              ],
            },
            { titleKey: 'macro.presets.twitch.runAd', icon: 'mdi-advertisements', factory: () => this.createTask({ channel: 'twitch', method: 'ad', data: { duration: 30, variable: 'ad' } }) },
          ],
        },
        {
          titleKey: 'macro.presets.yolobox.title',
          icon: 'mdi-video-wireless-outline',
          children: [
            {
              titleKey: 'macro.presets.yolobox.switchVideoSource',
              icon: 'mdi-video-switch',
              factory: () => this.createTask({
                channel: 'yolobox',
                method: 'switch_video_source',
                data: { id: '' },
              }),
            },
            {
              titleKey: 'macro.presets.yolobox.overlays.title',
              icon: 'mdi-layers-outline',
              children: [
                {
                  titleKey: 'macro.presets.yolobox.overlays.enableOverlay',
                  icon: 'mdi-eye-outline',
                  factory: () => this.createTask({
                    channel: 'yolobox',
                    method: 'set_overlay',
                    data: { id: '', isSelected: true },
                  }),
                },
                {
                  titleKey: 'macro.presets.yolobox.overlays.disableOverlay',
                  icon: 'mdi-eye-off-outline',
                  factory: () => this.createTask({
                    channel: 'yolobox',
                    method: 'set_overlay',
                    data: { id: '', isSelected: false },
                  }),
                },
                {
                  titleKey: 'macro.presets.yolobox.overlays.disableAllOverlays',
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
              titleKey: 'macro.presets.yolobox.audioSource.title',
              icon: 'mdi-tune-vertical',
              children: [
                {
                  titleKey: 'macro.presets.yolobox.audioSource.setVolume',
                  icon: 'mdi-volume-high',
                  factory: () => this.createTask({
                    channel: 'yolobox',
                    method: 'set_audio_volume',
                    data: { id: '', volume: 1 },
                  }),
                },
                {
                  titleKey: 'macro.presets.yolobox.audioSource.mute',
                  icon: 'mdi-volume-off',
                  factory: () => this.createTask({
                    channel: 'yolobox',
                    method: 'set_audio_muted',
                    data: { id: '', muted: true },
                  }),
                },
                {
                  titleKey: 'macro.presets.yolobox.audioSource.unmute',
                  icon: 'mdi-volume-high',
                  factory: () => this.createTask({
                    channel: 'yolobox',
                    method: 'set_audio_muted',
                    data: { id: '', muted: false },
                  }),
                },
                {
                  titleKey: 'macro.presets.yolobox.audioSource.setDelay',
                  icon: 'mdi-timer-outline',
                  factory: () => this.createTask({
                    channel: 'yolobox',
                    method: 'set_audio_delay',
                    data: { id: '', delayTime: 0 },
                  }),
                },
                {
                  titleKey: 'macro.presets.yolobox.audioSource.enableAfv',
                  icon: 'mdi-link-variant',
                  factory: () => this.createTask({
                    channel: 'yolobox',
                    method: 'set_audio_afv',
                    data: { id: '', AFV: true },
                  }),
                },
                {
                  titleKey: 'macro.presets.yolobox.audioSource.disableAfv',
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
              titleKey: 'macro.presets.yolobox.streaming.title',
              icon: 'mdi-broadcast',
              children: [
                {
                  titleKey: 'macro.presets.yolobox.streaming.goLive',
                  icon: 'mdi-play-circle-outline',
                  factory: () => this.createTask({
                    channel: 'yolobox',
                    method: 'set_live_status',
                    data: { status: 'start' },
                  }),
                },
                {
                  titleKey: 'macro.presets.yolobox.streaming.stopStream',
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
          titleKey: 'macro.presets.obs.title',
          icon: 'mdi-broadcast',
          children: [
            {
              titleKey: 'macro.presets.obs.scenes.title',
              icon: 'mdi-monitor-screenshot',
              children: [
                { titleKey: 'macro.presets.obs.scenes.switchScene', icon: 'mdi-monitor-screenshot', factory: () => this.createTask({ channel: 'obs', method: 'SetCurrentProgramScene', data: { sceneName: '' } }) },
                { titleKey: 'macro.presets.obs.scenes.switchPreviewScene', icon: 'mdi-monitor-eye', factory: () => this.createTask({ channel: 'obs', method: 'SetCurrentPreviewScene', data: { sceneName: '' } }) },
              ],
            },
            {
              titleKey: 'macro.presets.obs.sceneItems.title',
              icon: 'mdi-layers-outline',
              children: [
                { titleKey: 'macro.presets.obs.sceneItems.showSceneItem', icon: 'mdi-eye', factory: () => this.createTask({ channel: 'obs', method: 'SetSceneItemEnabled', data: { sceneName: '', sceneItemId: null, sceneItemEnabled: true } }) },
                { titleKey: 'macro.presets.obs.sceneItems.hideSceneItem', icon: 'mdi-eye-off', factory: () => this.createTask({ channel: 'obs', method: 'SetSceneItemEnabled', data: { sceneName: '', sceneItemId: null, sceneItemEnabled: false } }) },
                { titleKey: 'macro.presets.obs.sceneItems.lockSceneItem', icon: 'mdi-lock', factory: () => this.createTask({ channel: 'obs', method: 'SetSceneItemLocked', data: { sceneName: '', sceneItemId: null, sceneItemLocked: true } }) },
                { titleKey: 'macro.presets.obs.sceneItems.unlockSceneItem', icon: 'mdi-lock-open-variant', factory: () => this.createTask({ channel: 'obs', method: 'SetSceneItemLocked', data: { sceneName: '', sceneItemId: null, sceneItemLocked: false } }) },
                { titleKey: 'macro.presets.obs.sceneItems.transformSceneItem', icon: 'mdi-vector-square', factory: () => this.createTask({ channel: 'obs', method: 'SetSceneItemTransform', data: { sceneName: '', sceneItemId: null, sceneItemTransform: { positionX: 0, positionY: 0, scaleX: 1, scaleY: 1, rotation: 0 } } }) },
              ],
            },
            {
              titleKey: 'macro.presets.obs.audio.title',
              icon: 'mdi-volume-high',
              children: [
                { titleKey: 'macro.presets.obs.audio.muteInput', icon: 'mdi-volume-off', factory: () => this.createTask({ channel: 'obs', method: 'SetInputMute', data: { inputName: '', inputMuted: true } }) },
                { titleKey: 'macro.presets.obs.audio.unmuteInput', icon: 'mdi-volume-high', factory: () => this.createTask({ channel: 'obs', method: 'SetInputMute', data: { inputName: '', inputMuted: false } }) },
                { titleKey: 'macro.presets.obs.audio.toggleInputMute', icon: 'mdi-volume-medium', factory: () => this.createTask({ channel: 'obs', method: 'ToggleInputMute', data: { inputName: '' } }) },
                { titleKey: 'macro.presets.obs.audio.setInputVolume', icon: 'mdi-volume-source', factory: () => this.createTask({ channel: 'obs', method: 'SetInputVolume', data: { inputName: '', inputVolumeDb: 0 } }) },
              ],
            },
            {
              titleKey: 'macro.presets.obs.filters.title',
              icon: 'mdi-filter',
              children: [
                { titleKey: 'macro.presets.obs.filters.enableSourceFilter', icon: 'mdi-filter-check', factory: () => this.createTask({ channel: 'obs', method: 'SetSourceFilterEnabled', data: { sourceName: '', filterName: '', filterEnabled: true } }) },
                { titleKey: 'macro.presets.obs.filters.disableSourceFilter', icon: 'mdi-filter-off', factory: () => this.createTask({ channel: 'obs', method: 'SetSourceFilterEnabled', data: { sourceName: '', filterName: '', filterEnabled: false } }) },
              ],
            },
            {
              titleKey: 'macro.presets.obs.streaming.title',
              icon: 'mdi-broadcast',
              children: [
                { titleKey: 'macro.presets.obs.streaming.startStream', icon: 'mdi-broadcast', factory: () => this.createTask({ channel: 'obs', method: 'StartStream', data: {} }) },
                { titleKey: 'macro.presets.obs.streaming.stopStream', icon: 'mdi-broadcast-off', factory: () => this.createTask({ channel: 'obs', method: 'StopStream', data: {} }) },
                { titleKey: 'macro.presets.obs.streaming.toggleStream', icon: 'mdi-broadcast', factory: () => this.createTask({ channel: 'obs', method: 'ToggleStream', data: {} }) },
              ],
            },
            {
              titleKey: 'macro.presets.obs.recording.title',
              icon: 'mdi-record-rec',
              children: [
                { titleKey: 'macro.presets.obs.recording.startRecording', icon: 'mdi-record-rec', factory: () => this.createTask({ channel: 'obs', method: 'StartRecord', data: {} }) },
                { titleKey: 'macro.presets.obs.recording.stopRecording', icon: 'mdi-stop-circle', factory: () => this.createTask({ channel: 'obs', method: 'StopRecord', data: {} }) },
                { titleKey: 'macro.presets.obs.recording.toggleRecording', icon: 'mdi-record-circle-outline', factory: () => this.createTask({ channel: 'obs', method: 'ToggleRecord', data: {} }) },
                { titleKey: 'macro.presets.obs.recording.pauseRecording', icon: 'mdi-pause-circle', factory: () => this.createTask({ channel: 'obs', method: 'PauseRecord', data: {} }) },
                { titleKey: 'macro.presets.obs.recording.resumeRecording', icon: 'mdi-play-circle', factory: () => this.createTask({ channel: 'obs', method: 'ResumeRecord', data: {} }) },
              ],
            },
            {
              titleKey: 'macro.presets.obs.replayBuffer.title',
              icon: 'mdi-history',
              children: [
                { titleKey: 'macro.presets.obs.replayBuffer.startReplayBuffer', icon: 'mdi-history', factory: () => this.createTask({ channel: 'obs', method: 'StartReplayBuffer', data: {} }) },
                { titleKey: 'macro.presets.obs.replayBuffer.stopReplayBuffer', icon: 'mdi-history', factory: () => this.createTask({ channel: 'obs', method: 'StopReplayBuffer', data: {} }) },
                { titleKey: 'macro.presets.obs.replayBuffer.saveReplayBuffer', icon: 'mdi-content-save', factory: () => this.createTask({ channel: 'obs', method: 'SaveReplayBuffer', data: {} }) },
              ],
            },
            {
              titleKey: 'macro.presets.obs.tools.title',
              icon: 'mdi-tools',
              children: [
                { titleKey: 'macro.presets.obs.tools.reloadBrowserSources', icon: 'mdi-refresh', factory: () => this.createTask({ channel: 'obs', method: 'reload_browser_sources', data: {} }) },
                { titleKey: 'macro.presets.obs.tools.triggerHotkey', icon: 'mdi-keyboard', factory: () => this.createTask({ channel: 'obs', method: 'TriggerHotkeyByName', data: { hotkeyName: '' } }) },
                { titleKey: 'macro.presets.obs.tools.setProfile', icon: 'mdi-account-cog', factory: () => this.createTask({ channel: 'obs', method: 'SetCurrentProfile', data: { profileName: '' } }) },
                { titleKey: 'macro.presets.obs.tools.setSceneCollection', icon: 'mdi-folder-cog', factory: () => this.createTask({ channel: 'obs', method: 'SetCurrentSceneCollection', data: { sceneCollectionName: '' } }) },
              ],
            },
          ],
        },

        {
          titleKey: 'macro.presets.lights.title',
          icon: 'mdi-led-on',
          children: [
            {
              titleKey: 'macro.presets.lights.wled',
              icon: 'mdi-led-strip-variant',
              factory: () => this.createTask({ channel: 'wled', method: 'custom', data: { name: '', red: 255, green: 255, blue: 255, white: 0, brightness: 255, effect: 0 } }),
            },
            {
              titleKey: 'macro.presets.lights.wledOff',
              icon: 'mdi-led-strip-variant-off',
              factory: () => this.createTask({ channel: 'wled', method: 'off', data: { name: '' } }),
            },
          ]
        },
        {
          titleKey: 'macro.presets.system.title',
          icon: 'mdi-power-settings',
          children: [
            {
              titleKey: 'macro.presets.system.reboot',
              icon: 'mdi-restart',
              factory: () => this.createTask({ channel: 'system', method: 'reboot', data: {} }),
            },
            {
              titleKey: 'macro.presets.system.shutdown',
              icon: 'mdi-power',
              factory: () => this.createTask({ channel: 'system', method: 'shutdown', data: {} }),
            },
          ],
        },
        {
          titleKey: 'macro.presets.expert.title',
          icon: 'mdi-function',
          children: [
            {
              titleKey: 'macro.presets.expert.webhook',
              icon: 'mdi-webhook',
              factory: () => this.createTask({ channel: 'webhook', method: 'post', data: {} }),
            },
            {
              titleKey: 'macro.presets.expert.websocket',
              icon: 'mdi-connection',
              factory: () => this.createTask({ channel: 'websocket', method: '', data: {} }),
            },
            {
              titleKey: 'macro.presets.expert.apiRequest.title',
              icon: 'mdi-api',
              children: [
                {
                  titleKey: 'macro.presets.expert.apiRequest.get',
                  icon: 'mdi-download',
                  factory: () => this.createApiRequestTask('get'),
                },
                {
                  titleKey: 'macro.presets.expert.apiRequest.post',
                  icon: 'mdi-upload',
                  factory: () => this.createApiRequestTask('post'),
                },
                {
                  titleKey: 'macro.presets.expert.apiRequest.put',
                  icon: 'mdi-file-replace-outline',
                  factory: () => this.createApiRequestTask('put'),
                },
                {
                  titleKey: 'macro.presets.expert.apiRequest.patch',
                  icon: 'mdi-file-edit-outline',
                  factory: () => this.createApiRequestTask('patch'),
                },
                {
                  titleKey: 'macro.presets.expert.apiRequest.delete',
                  icon: 'mdi-delete-outline',
                  factory: () => this.createApiRequestTask('delete'),
                },
              ],
            },
            {
              titleKey: 'macro.presets.expert.rawTask',
              icon: 'mdi-code-json',
              factory: () => this.createTask({ channel: '', method: '', data: {} }),
            },
            {
              titleKey: 'macro.presets.expert.keyboard',
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
    presetTitle(preset: any): string {
      if (preset?.titleKey) return this.$t(preset.titleKey)
      return preset?.title ?? ''
    },

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

      if (item?.task?.channel === 'system') {
        if (['shutdown', 'halt', 'poweroff'].includes(item?.task?.method)) {
          return 'MacroSystemShutdownTaskAccordion'
        }
        if (['reboot', 'restart'].includes(item?.task?.method)) {
          return 'MacroSystemRebootTaskAccordion'
        }
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
