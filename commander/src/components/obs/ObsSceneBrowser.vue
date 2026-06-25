<template>
  <v-card color="grey-darken-4 pt-2" elevation="0" rounded="0">
    <v-card-title class="d-flex align-center justify-space-between py-5">
      <span class="mr-2">{{ $t('obs.settings.title') }}</span>
      <v-chip size="small" variant="tonal">
        {{ scenes.length }}
      </v-chip>
      <v-spacer></v-spacer>
    </v-card-title>

    <v-card-text class="obs-browser-content">
      <v-alert
        v-if="scenes.length === 0"
        type="info"
        variant="tonal"
        density="compact"
        :text="$t('obs.settings.empty')"
      />

      <v-expansion-panels v-else v-model="expandedScenes" multiple color="grey-darken-3">
        <v-expansion-panel
          v-for="obsScene in scenes"
          :key="getSceneKey(obsScene)"
          :value="getSceneKey(obsScene)"
          :color="isActiveScene(obsScene) ? 'primary' : undefined"
          :class="{ 'obs-active-scene': isActiveScene(obsScene) }"
        >
          <v-expansion-panel-title>
            <div class="d-flex align-center justify-space-between w-100 pr-3 ga-3">
              <span class="text-truncate">{{ obsScene.name }}</span>
              <div class="d-flex align-center ga-2">
                <v-chip
                  v-if="isActiveScene(obsScene)"
                  size="x-small"
                  color="primary"
                  variant="flat"
                >
                  {{ $t('obs.settings.activeScene') }}
                </v-chip>
                <v-chip size="x-small" variant="tonal">{{ getItems(obsScene).length }}</v-chip>
              </div>
            </div>
          </v-expansion-panel-title>

          <v-expansion-panel-text class="pa-0">
            <v-table density="compact" class="wrap-anywhere obs-source-table">
              <tbody>
              <tr>
                <td>{{ $t('obs.settings.name') }}</td>
                <td>{{ obsScene.name }} <CopyButton :content="obsScene.name" /></td>
              </tr>
              <tr>
                <td>{{ $t('obs.settings.uuid') }}</td>
                <td>{{ obsScene.uuid }} <CopyButton :content="obsScene.uuid" /></td>
              </tr>
              <tr>
                <td>{{ $t('obs.settings.index') }}</td>
                <td>{{ obsScene.index }} <CopyButton :content="obsScene.index" /></td>
              </tr>
              </tbody>
            </v-table>

            <v-expansion-panels v-if="getItems(obsScene).length > 0" multiple class="mt-2">
              <v-expansion-panel
                v-for="obsItem in getItems(obsScene)"
                :key="obsItem.uuid || obsItem.id"
                color="grey-darken-4"
              >
                <v-expansion-panel-title>
                  <div class="d-flex align-center justify-space-between w-100 pr-3 ga-3">
                    <span class="text-truncate">{{ obsItem.name }}</span>
                  </div>
                </v-expansion-panel-title>

                <v-expansion-panel-text class="pa-0">
                  <v-table density="compact" class="wrap-anywhere obs-source-table">
                    <tbody>
                    <tr>
                      <td>{{ $t('obs.settings.name') }}</td>
                      <td>{{ obsItem.name }} <CopyButton :content="obsItem.name" /></td>
                    </tr>
                    <tr>
                      <td>{{ $t('obs.settings.uuid') }}</td>
                      <td>{{ obsItem.uuid }} <CopyButton :content="obsItem.uuid" /></td>
                    </tr>
                    <tr>
                      <td>{{ $t('obs.settings.id') }}</td>
                      <td>{{ obsItem.id }} <CopyButton :content="obsItem.id" /></td>
                    </tr>
                    <tr>
                      <td>{{ $t('obs.instance') }}</td>
                      <td>{{ connection }}</td>
                    </tr>
                    <tr v-if="hasApiWebsite">
                      <td colspan="2">
                        <v-btn
                          block
                          density="comfortable"
                          elevation="0"
                          color="primary"
                          prepend-icon="mdi-plus"
                          :loading="isAdding(obsItem)"
                          @click="addSource(obsItem)"
                        >
                          {{ $t('obs.settings.addSource') }}
                        </v-btn>
                      </td>
                    </tr>
                    </tbody>
                  </v-table>
                </v-expansion-panel-text>
              </v-expansion-panel>
            </v-expansion-panels>
          </v-expansion-panel-text>
        </v-expansion-panel>
      </v-expansion-panels>
    </v-card-text>
  </v-card>
</template>

<script lang="ts">
import { getWebsocketClient } from '@/plugins/websocketInstance'
import { useAppStore } from '@/stores/app'

export default {
  props: {
    connection: {
      type: String,
      default: 'default',
    },
    scenes: {
      type: Array,
      default: () => [],
    },
    currentScene: {
      type: Object,
      default: () => ({}),
    },
    currentSceneUuid: {
      type: String,
      default: '',
    },
    currentSceneName: {
      type: String,
      default: '',
    },
  },

  data() {
    return {
      addingSources: {} as Record<string, boolean>,
      expandedScenes: [] as string[],
    }
  },

  computed: {
    appStore() {
      return useAppStore()
    },

    hasApiWebsite(): boolean {
      return Boolean((this.appStore as any).hasApiWebsite)
    },
  },

  watch: {
    scenes: {
      handler() {
        this.expandActiveScene()
      },
      deep: true,
      immediate: true,
    },

    currentSceneUuid() {
      this.expandActiveScene()
    },

    currentSceneName() {
      this.expandActiveScene()
    },
  },

  methods: {
    getItems(scene: any): any[] {
      return Array.isArray(scene?.items) ? scene.items : []
    },

    getSceneKey(scene: any): string {
      return String(scene?.uuid ?? scene?.name ?? scene?.index ?? '')
    },

    getActiveSceneUuid(): string {
      return String(
        this.currentSceneUuid
        || (this.currentScene as any)?.uuid
        || (this.currentScene as any)?.sceneUuid
        || ''
      )
    },

    getActiveSceneName(): string {
      return String(
        this.currentSceneName
        || (this.currentScene as any)?.name
        || (this.currentScene as any)?.sceneName
        || ''
      )
    },

    isActiveScene(scene: any): boolean {
      if(scene?.active || scene?.current || scene?.isActive || scene?.isCurrentProgramScene) {
        return true
      }

      const activeUuid = this.getActiveSceneUuid()
      if(activeUuid && String(scene?.uuid ?? '') === activeUuid) {
        return true
      }

      const activeName = this.getActiveSceneName()
      return Boolean(activeName && String(scene?.name ?? '') === activeName)
    },

    expandActiveScene() {
      const activeScene = (this.scenes as any[]).find(scene => this.isActiveScene(scene))
      if(!activeScene) return

      const key = this.getSceneKey(activeScene)
      if(!key || this.expandedScenes.includes(key)) return

      this.expandedScenes = [...this.expandedScenes, key]
    },

    getSourceKey(source: any): string {
      return String(source?.uuid ?? source?.id ?? source?.name ?? '')
    },

    isAdding(source: any): boolean {
      return Boolean(this.addingSources[this.getSourceKey(source)])
    },

    async addSource(source: any) {
      const uuid = String(source?.uuid ?? '')
      const name = String(source?.name ?? '')

      if(!uuid || !name) return

      const key = this.getSourceKey(source)
      this.addingSources[key] = true

      try {
        getWebsocketClient()?.send('add_source', {
          name,
          uuid,
          obs_id: this.connection,
        })
      } catch (error) {
        console.warn(error)
      } finally {
        this.addingSources[key] = false
      }
    },
  },
}
</script>

<style scoped>
.obs-source-table :deep(td:first-child) {
  width: 120px;
  color: rgba(var(--v-theme-on-surface), 0.68);
  font-weight: 700;
}
.obs-active-scene :deep(.v-expansion-panel-title) {
  color: rgb(var(--v-theme-on-primary));
}

.obs-browser-content {
  max-height: calc(100vh - 130px);
  overflow-y: auto;
}
</style>
