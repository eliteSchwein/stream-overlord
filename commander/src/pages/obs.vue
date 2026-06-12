<template>
  <v-row class="obs-page-layout ma-0 pa-0" density="comfortable" no-gutters>

    <v-col cols="12" xxl="6" class="obs-page-panel">
      <ObsAudioMixer
        :connection="selectedConnection"
        :audio-data="selectedAudioData"
      />
    </v-col>

    <v-col cols="12" xxl="6" class="obs-page-panel obs-page-panel--right">
      <v-alert
        :text="$t('obs.disclaimer')"
        type="warning"
        icon="mdi-alert-circle"
      ></v-alert>
      <ObsSceneBrowser :scenes="selectedSceneData" />
    </v-col>
  </v-row>
</template>

<script lang="ts">
import { mapState } from 'pinia'
import { useAppStore } from '@/stores/app'
import ObsAudioMixer from '@/components/obs/ObsAudioMixer.vue'
import ObsSceneBrowser from '@/components/obs/ObsSceneBrowser.vue'

export default {
  components: {
    ObsAudioMixer,
    ObsSceneBrowser,
  },

  data() {
    return {
      selectedConnection: 'default',
    }
  },

  computed: {
    ...mapState(useAppStore, [
      'getObsSceneData',
      'getObsSceneDataByConnection',
      'getObsAudioData',
      'getObsAudioDataByConnection',
    ]),

    connectionNames(): string[] {
      const names = new Set<string>()

      Object.keys(this.getObsSceneDataByConnection ?? {}).forEach(name => names.add(name))
      Object.keys(this.getObsAudioDataByConnection ?? {}).forEach(name => names.add(name))

      if(names.size === 0 && (this.getObsSceneData?.length || Object.keys(this.getObsAudioData ?? {}).length)) {
        names.add('default')
      }

      return Array.from(names).sort((a, b) => a.localeCompare(b))
    },

    selectedAudioData(): Record<string, any> {
      return this.getObsAudioDataByConnection?.[this.selectedConnection] ?? this.getObsAudioData ?? {}
    },

    selectedSceneData(): any[] {
      return this.getObsSceneDataByConnection?.[this.selectedConnection] ?? this.getObsSceneData ?? []
    },
  },

  watch: {
    connectionNames: {
      immediate: true,
      handler(names: string[]) {
        if(names.length > 0 && !names.includes(this.selectedConnection)) {
          this.selectedConnection = names[0]
        }
      },
    },
  },
}
</script>

<style scoped>
.obs-page-layout {
  width: 100%;
  max-height: calc(100vh - 54px);
  overflow-y: auto;
}

.obs-page-panel {
  min-width: 0;
}

.obs-page-panel + .obs-page-panel {
  border-top: thin solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.obs-instance-select {
  max-width: 280px;
}

@media (min-width: 2560px) {
  .obs-page-panel--right {
    border-top: 0;
    border-left: thin solid rgba(var(--v-border-color), var(--v-border-opacity));
  }
}
</style>
