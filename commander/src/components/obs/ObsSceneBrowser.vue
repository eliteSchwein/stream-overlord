<template>
  <div class="obs-browser-content">
    <v-alert
      v-if="sceneCount === 0"
      type="info"
      variant="tonal"
      density="compact"
      :text="$t('obs.settings.empty')"
    />

    <v-card
      v-for="canvas in canvases"
      v-else
      :key="getCanvasKey(canvas)"
      color="grey-darken-4"
      class="pt-2 obs-page-panel"
      elevation="0"
      rounded="0"
    >
      <v-card-title class="d-flex align-center justify-space-between py-5">
        <span class="mr-2 text-truncate">{{ $t('obs.settings.title') }} {{ getCanvasName(canvas) }}</span>
        <v-chip size="small" variant="tonal">
          {{ getCanvasScenes(canvas).length }}
        </v-chip>
        <v-spacer></v-spacer>
      </v-card-title>

      <v-card-text>
        <v-table density="compact" class="wrap-anywhere obs-source-table mb-3">
          <tbody>
          <tr>
            <td>{{ $t('obs.settings.name') }}</td>
            <td>{{ getCanvasName(canvas) }} <CopyButton :content="getCanvasName(canvas)" /></td>
          </tr>
          <tr v-if="getCanvasUuid(canvas)">
            <td>{{ $t('obs.settings.uuid') }}</td>
            <td>{{ getCanvasUuid(canvas) }} <CopyButton :content="getCanvasUuid(canvas)" /></td>
          </tr>
          <tr v-if="canvas.index !== undefined">
            <td>{{ $t('obs.settings.index') }}</td>
            <td>{{ canvas.index }} <CopyButton :content="canvas.index" /></td>
          </tr>
          </tbody>
        </v-table>

        <v-alert
          v-if="getCanvasScenes(canvas).length === 0"
          type="info"
          variant="tonal"
          density="compact"
          :text="$t('obs.settings.empty')"
        />

        <v-expansion-panels
          v-else
          v-model="expandedScenes"
          multiple
          color="grey-darken-3"
        >
          <v-expansion-panel
            v-for="obsScene in getCanvasScenes(canvas)"
            :key="getSceneKey(obsScene, canvas)"
            :value="getSceneKey(obsScene, canvas)"
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
                <tr>
                  <td>Canvas</td>
                  <td>{{ getCanvasName(canvas) }} <CopyButton :content="getCanvasUuid(canvas)" /></td>
                </tr>
                </tbody>
              </v-table>

              <v-expansion-panels
                v-if="getItems(obsScene).length > 0"
                v-model="expandedSources"
                multiple
                class="mt-2"
              >
                <v-expansion-panel
                  v-for="obsItem in getItems(obsScene)"
                  :key="getSourceKey(obsItem, obsScene, canvas)"
                  :value="getSourceKey(obsItem, obsScene, canvas)"
                  color="grey-darken-4"
                  :class="{ 'obs-active-source': isActiveSource(obsItem) }"
                >
                  <v-expansion-panel-title>
                    <div class="d-flex align-center justify-space-between w-100 pr-3 ga-3">
                      <span class="text-truncate">{{ obsItem.name }}</span>
                      <v-chip
                        v-if="isActiveSource(obsItem)"
                        size="x-small"
                        color="primary"
                        variant="flat"
                      >
                        {{ $t('obs.settings.active') }}
                      </v-chip>
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
  </div>
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
      expandedSources: [] as string[],
    }
  },

  computed: {
    appStore() {
      return useAppStore()
    },

    hasApiWebsite(): boolean {
      return Boolean((this.appStore as any).hasApiWebsite)
    },

    canvases(): any[] {
      const rawScenes = Array.isArray(this.scenes) ? this.scenes as any[] : []

      if (rawScenes.some(entry => this.getCanvasScenes(entry).length > 0)) {
        return rawScenes
      }

      return [
        {
          name: this.$t ? this.$t('obs.settings.title') : 'Default',
          uuid: 'default',
          scenes: rawScenes,
        },
      ]
    },

    sceneCount(): number {
      return this.canvases.reduce((count: number, canvas: any) => count + this.getCanvasScenes(canvas).length, 0)
    },
  },

  watch: {
    scenes: {
      handler() {
        this.expandOnlyActivePanels()
      },
      deep: true,
      immediate: true,
    },

    currentSceneUuid() {
      this.expandOnlyActivePanels()
    },

    currentSceneName() {
      this.expandOnlyActivePanels()
    },
  },

  methods: {
    getCanvasScenes(canvas: any): any[] {
      return Array.isArray(canvas?.scenes) ? canvas.scenes : []
    },

    getCanvasName(canvas: any): string {
      return String(canvas?.name ?? canvas?.canvasName ?? 'Default')
    },

    getCanvasUuid(canvas: any): string {
      return String(canvas?.uuid ?? canvas?.canvasUuid ?? '')
    },

    getCanvasKey(canvas: any): string {
      return String(this.getCanvasUuid(canvas) || this.getCanvasName(canvas) || canvas?.index || '')
    },

    getItems(scene: any): any[] {
      return Array.isArray(scene?.items) ? scene.items : []
    },

    getSceneKey(scene: any, canvas: any = null): string {
      return `${this.getCanvasKey(canvas)}:${String(scene?.uuid ?? scene?.name ?? scene?.index ?? '')}`
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

    isActiveSource(source: any): boolean {
      return Boolean(
        source?.active
        || source?.current
        || source?.selected
        || source?.isActive
        || source?.isSelected
        || source?.isCurrent
      )
    },

    expandOnlyActivePanels() {
      const activeSceneKeys: string[] = []
      const activeSourceKeys: string[] = []

      for (const canvas of this.canvases) {
        for (const scene of this.getCanvasScenes(canvas)) {
          if (this.isActiveScene(scene)) {
            activeSceneKeys.push(this.getSceneKey(scene, canvas))
          }

          for (const source of this.getItems(scene)) {
            if (this.isActiveSource(source)) {
              activeSceneKeys.push(this.getSceneKey(scene, canvas))
              activeSourceKeys.push(this.getSourceKey(source, scene, canvas))
            }
          }
        }
      }

      this.expandedScenes = [...new Set(activeSceneKeys.filter(Boolean))]
      this.expandedSources = [...new Set(activeSourceKeys.filter(Boolean))]
    },

    getSourceKey(source: any, scene: any = null, canvas: any = null): string {
      return `${this.getSceneKey(scene, canvas)}:${String(source?.uuid ?? source?.id ?? source?.name ?? '')}`
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

.obs-active-source :deep(.v-expansion-panel-title) {
  color: rgb(var(--v-theme-primary));
}

.obs-browser-content {
  max-height: calc(100vh - 130px);
  overflow-y: auto;
}
.obs-page-panel {
  border-top: thin solid rgba(var(--v-border-color), var(--v-border-opacity));
}
</style>
