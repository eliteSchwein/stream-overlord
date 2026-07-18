<template>
  <div>
    <v-select
      :model-value="modelValue"
      :items="rotatingSceneOptions"
      :label="label"
      clearable
      hide-details="auto"
      prepend-inner-icon="mdi-rotate-3d-variant"
      variant="outlined"
      density="comfortable"
      :loading="loading"
      :disabled="disabled"
      v-model:menu="menuOpen"
      @update:menu="handleMenuUpdate"
      @update:model-value="$emit('update:modelValue', $event ?? '')"
    >
      <template #append-inner>
        <v-btn
          v-if="hasSelectedRotatingScene"
          icon="mdi-pencil"
          size="x-small"
          variant="text"
          :disabled="disabled || loading"
          @mousedown.stop.prevent
          @click.stop.prevent="openEditRotatingScene"
        />
      </template>

      <template #prepend-item>
        <v-list-item prepend-icon="mdi-plus" @click="openCreateRotatingScene">
          <v-list-item-title>{{ createLabel }}</v-list-item-title>
        </v-list-item>
        <v-divider class="my-1" />
      </template>
    </v-select>

    <RotatingSceneEditorDialog
      ref="rotatingSceneEditorDialog"
      v-model="editorDialog"
      :name="selectedRotatingSceneName"
      :rotating-scene="selectedRotatingScene"
      :file-path="selectedRotatingSceneFile"
      @saved="handleRotatingSceneSaved"
    />
  </div>
</template>

<script lang="ts">
import { getWebsocketClient } from '@/plugins/websocketInstance'
import { defineAsyncComponent } from 'vue'

type RotatingSceneOption = {
  title: string
  value: string
  rotatingScene?: any
}

export default {
  name: 'RotatingSceneSelect',

  components: {
    RotatingSceneEditorDialog: defineAsyncComponent(() => import('@/components/dialogs/RotatingSceneEditorDialog.vue')),
  },

  props: {
    modelValue: { type: String, default: '' },
    label: { type: String, default: 'Rotating scene' },
    disabled: { type: Boolean, default: false },
  },

  emits: ['update:modelValue', 'saved'],

  data() {
    return {
      loading: false,
      loaded: false,
      menuOpen: false,
      rotatingSceneOptions: [] as RotatingSceneOption[],
      editorDialog: false,
      selectedRotatingSceneName: '',
      selectedRotatingScene: null as any,
      selectedRotatingSceneFile: '',
    }
  },

  computed: {
    hasSelectedRotatingScene(): boolean {
      return String(this.modelValue ?? '').trim().length > 0
    },

    createLabel(): string {
      return 'Create rotating scene'
    },
  },

  methods: {
    async requestWebsocket(method: string, params: Record<string, any>, timeout = 30000): Promise<any> {
      const client = getWebsocketClient()
      if (!client) throw new Error('websocket is not connected')
      const response = await client.request(method, params, timeout)
      return response?.params ?? response
    },

    unwrapResponse(response: any, method = ''): any {
      const resultKey = method ? `result_${String(method).replace(/[^a-zA-Z0-9_]/g, '_')}` : ''
      const containers = [response, response?.data, response?.payload, response?.result].filter(Boolean)

      if (resultKey) {
        for (const container of containers) {
          if (container && typeof container === 'object' && Object.prototype.hasOwnProperty.call(container, resultKey)) {
            return container[resultKey]
          }
        }
      }

      for (const container of containers) {
        if (container && typeof container === 'object') {
          if (Object.prototype.hasOwnProperty.call(container, 'result')) return container.result
          if (Object.prototype.hasOwnProperty.call(container, 'data')) return container.data
          if (Object.prototype.hasOwnProperty.call(container, 'payload')) return container.payload
        }
      }

      return response
    },

    async requestRotatingSceneEndpoint(method: string, params: Record<string, any>): Promise<any> {
      const response = await this.requestWebsocket(method, params, timeout)
      const data = this.unwrapResponse(response, method)
      if (data?.error) throw new Error(data.error)
      if (data?.success === false) throw new Error(data?.message ?? `${method} failed`)
      return data
    },

    async handleMenuUpdate(open: boolean) {
      if (!open || this.loaded || this.loading) return
      await this.refreshRotatingScenes()
    },

    parseRotatingSceneName(content: string, fallback = ''): string {
      const nameMatch = String(content ?? '').match(/^\s*name\s*:\s*["']?([^"'\n#]+)["']?/m)
      return String(nameMatch?.[1] ?? fallback ?? '').trim()
    },

    async refreshRotatingScenes() {
      this.loading = true

      try {
        const listResponse = await this.requestRotatingSceneEndpoint('rotating_scene_list')
        const files = Array.isArray(listResponse?.files) ? listResponse.files : []
        const options = new Map<string, RotatingSceneOption>()

        for (const file of files.filter((item: any) => item?.type === 'file')) {
          const fallbackName = String(file?.name ?? file?.path ?? '').replace(/\.(yaml|yml|json)$/i, '')
          let name = fallbackName
          let rotatingScene: any = { name, file: String(file?.path ?? `${name}.yaml`) }

          try {
            const readResponse = await this.requestRotatingSceneEndpoint('rotating_scene_read', {
              path: file.path,
              file: file.path,
            })
            const content = String(readResponse?.content ?? '')
            name = this.parseRotatingSceneName(content, fallbackName)
            rotatingScene = { name, file: String(readResponse?.path ?? file.path ?? `${name}.yaml`) }
          } catch (error) {
            console.warn(error)
          }

          if (name) options.set(name, { title: name, value: name, rotatingScene })
        }

        const current = String(this.modelValue ?? '').trim()
        if (current && !options.has(current)) {
          options.set(current, { title: current, value: current, rotatingScene: { name: current } })
        }

        this.rotatingSceneOptions = Array.from(options.values()).sort((a, b) => a.title.localeCompare(b.title))
        this.loaded = true
      } catch (error) {
        console.warn(error)
      } finally {
        this.loading = false
      }
    },

    findRotatingScene(name: string) {
      return this.rotatingSceneOptions.find((option) => option.value === name)?.rotatingScene ?? { name }
    },

    openCreateRotatingScene() {
      this.menuOpen = false
      this.selectedRotatingSceneName = ''
      this.selectedRotatingScene = {
        name: 'rotating_scene',
        interval: 1,
        scenes: [],
      }
      this.selectedRotatingSceneFile = ''
      this.editorDialog = true
      this.$nextTick(() => (this.$refs.rotatingSceneEditorDialog as any)?.open?.())
    },

    async openEditRotatingScene() {
      const name = String(this.modelValue ?? '').trim()
      if (!name) return

      if (!this.loaded) await this.refreshRotatingScenes()

      const rotatingScene = this.findRotatingScene(name)
      this.selectedRotatingSceneName = name
      this.selectedRotatingScene = rotatingScene
      this.selectedRotatingSceneFile = rotatingScene?.file ?? `${name}.yaml`
      this.editorDialog = true
      this.$nextTick(() => (this.$refs.rotatingSceneEditorDialog as any)?.open?.())
    },

    async handleRotatingSceneSaved(data: any) {
      const editor = this.$refs.rotatingSceneEditorDialog as any
      const name = String(
        editor?.visualRotatingScene?.name ??
        data?.name ??
        data?.rotatingScene?.name ??
        this.selectedRotatingSceneName ??
        ''
      ).trim()

      if (name) this.$emit('update:modelValue', name)
      this.$emit('saved', name || data)
      this.editorDialog = false
      this.loaded = false
      await this.refreshRotatingScenes()
    },
  },
}
</script>
