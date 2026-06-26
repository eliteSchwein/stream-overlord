<template>
  <v-expansion-panel>
    <v-expansion-panel-title>
      <div class="d-flex align-center ga-2 min-width-0 w-100">
        <v-icon icon="mdi-webhook" />
        <span class="text-truncate">Webhook</span>
        <v-chip v-if="isDiscordWebhook" size="x-small" color="indigo" variant="tonal">
          Discord
        </v-chip>
        <v-chip v-else size="x-small" variant="tonal">{{ methodLabel }}</v-chip>
      </div>
    </v-expansion-panel-title>

    <v-expansion-panel-text>
      <v-row density="comfortable">
        <v-col cols="12" md="3">
          <v-select
            v-model="task.method"
            :items="methodOptions"
            label="Method"
            prepend-inner-icon="mdi-swap-horizontal"
            variant="outlined"
            density="comfortable"
            hide-details="auto"
          />
        </v-col>

        <v-col cols="12" md="9">
          <v-text-field
            v-model="formData.url"
            label="URL"
            prepend-inner-icon="mdi-link"
            variant="outlined"
            density="comfortable"
            hide-details="auto"
          />
        </v-col>


        <v-col :cols="12" :md="isDiscordWebhook ? 7 : 12">
          <template v-if="!isDiscordWebhook">
            <v-textarea
              v-model="formData.content"
              label="Raw body"
              variant="outlined"
              density="comfortable"
              hide-details="auto"
              auto-grow
              rows="16"
              spellcheck="false"
              class="webhook-content-input"
            />
          </template>

          <v-card v-else variant="tonal" class="discord-visual-editor">
            <v-card-title class="d-flex align-center ga-2 text-subtitle-1">
              <v-icon icon="mdi-discord" />
              <span>Discord embed editor</span>
              <v-spacer />
              <v-switch
                v-model="rawDiscordEditor"
                label="Raw"
                color="primary"
                density="compact"
                hide-details
                inset
              />
            </v-card-title>

            <v-card-text>
              <template v-if="rawDiscordEditor">
                <v-textarea
                  v-model="formData.content"
                  label="Raw body"
                  variant="outlined"
                  density="comfortable"
                  hide-details="auto"
                  auto-grow
                  rows="16"
                  spellcheck="false"
                  class="webhook-content-input"
                />

                <div class="d-flex flex-wrap ga-2 mt-3">
                  <v-btn
                    size="small"
                    variant="tonal"
                    prepend-icon="mdi-code-json"
                    :disabled="!canFormatContent"
                    @click="formatContent"
                  >
                    Format JSON
                  </v-btn>

                  <v-btn
                    size="small"
                    variant="tonal"
                    prepend-icon="mdi-code-braces"
                    :disabled="!canFormatContent"
                    @click="minifyContent"
                  >
                    Minify JSON
                  </v-btn>
                </div>
              </template>

              <template v-else>
                <v-textarea
                  :model-value="discordContent"
                  label="Message content"
                  variant="outlined"
                  density="comfortable"
                  hide-details="auto"
                  auto-grow
                  rows="2"
                  @update:model-value="setDiscordPayloadValue('content', $event)"
                />

                <v-divider class="my-4" />

                <v-row density="comfortable">
                  <v-col cols="12" md="8">
                    <v-text-field
                      :model-value="firstEmbed.author?.name ?? ''"
                      label="Author name"
                      variant="outlined"
                      density="comfortable"
                      hide-details="auto"
                      @update:model-value="setDiscordEmbedNestedValue('author', 'name', $event)"
                    />
                  </v-col>
                  <v-col cols="12" md="4">
                    <v-menu :close-on-content-click="false" location="bottom">
                      <template #activator="{ props }">
                        <v-text-field
                          v-bind="props"
                          :model-value="firstEmbedColorHex"
                          label="Color"
                          prepend-inner-icon="mdi-palette"
                          variant="outlined"
                          density="comfortable"
                          readonly
                          hide-details="auto"
                        >
                          <template #append-inner>
                            <div
                              class="discord-color-swatch"
                              :style="{ backgroundColor: firstEmbedColorHex }"
                            />
                          </template>
                        </v-text-field>
                      </template>

                      <v-card>
                        <v-color-picker
                          :model-value="firstEmbedColorHex"
                          mode="hex"
                          hide-inputs
                          @update:model-value="setDiscordEmbedColor"
                        />
                      </v-card>
                    </v-menu>
                  </v-col>
                  <v-col cols="12">
                    <v-text-field
                      :model-value="firstEmbed.author?.icon_url ?? ''"
                      label="Author icon URL"
                      variant="outlined"
                      density="comfortable"
                      hide-details="auto"
                      @update:model-value="setDiscordEmbedNestedValue('author', 'icon_url', $event)"
                    />
                  </v-col>
                  <v-col cols="12">
                    <v-text-field
                      :model-value="firstEmbed.title ?? ''"
                      label="Embed title"
                      variant="outlined"
                      density="comfortable"
                      hide-details="auto"
                      @update:model-value="setDiscordEmbedValue('title', $event)"
                    />
                  </v-col>
                  <v-col cols="12">
                    <v-textarea
                      :model-value="firstEmbed.description ?? ''"
                      label="Description"
                      variant="outlined"
                      density="comfortable"
                      hide-details="auto"
                      auto-grow
                      rows="2"
                      @update:model-value="setDiscordEmbedValue('description', $event)"
                    />
                  </v-col>
                  <v-col cols="12">
                    <v-text-field
                      :model-value="firstEmbed.image?.url ?? ''"
                      label="Image URL"
                      variant="outlined"
                      density="comfortable"
                      hide-details="auto"
                      @update:model-value="setDiscordEmbedNestedValue('image', 'url', $event)"
                    />
                  </v-col>
                  <v-col cols="12">
                    <v-text-field
                      :model-value="firstEmbed.footer?.text ?? ''"
                      label="Footer text"
                      variant="outlined"
                      density="comfortable"
                      hide-details="auto"
                      @update:model-value="setDiscordEmbedNestedValue('footer', 'text', $event)"
                    />
                  </v-col>
                </v-row>

                <div class="d-flex align-center justify-space-between mt-4 mb-2">
                  <div class="text-subtitle-2">Fields</div>
                  <v-btn size="small" variant="tonal" prepend-icon="mdi-plus" @click="addDiscordField">
                    Add field
                  </v-btn>
                </div>

                <v-card
                  v-for="(field, fieldIndex) in discordFields"
                  :key="fieldIndex"
                  class="discord-field-editor mb-3"
                >
                  <v-card-text class="pa-3">
                    <div class="discord-field-editor-grid">
                      <v-text-field
                        :model-value="field.name ?? ''"
                        label="Name"
                        variant="outlined"
                        density="comfortable"
                        hide-details="auto"
                        @update:model-value="updateDiscordField(fieldIndex, 'name', $event)"
                      />

                      <v-text-field
                        :model-value="field.value ?? ''"
                        label="Value"
                        variant="outlined"
                        density="comfortable"
                        hide-details="auto"
                        @update:model-value="updateDiscordField(fieldIndex, 'value', $event)"
                      />

                      <v-checkbox
                        :model-value="field.inline === true"
                        label="Inline"
                        density="compact"
                        hide-details
                        class="discord-field-inline-toggle"
                        @update:model-value="updateDiscordField(fieldIndex, 'inline', $event)"
                      />

                      <v-btn
                        icon="mdi-delete"
                        color="error"
                        variant="text"
                        size="small"
                        class="discord-field-delete"
                        @click="removeDiscordField(fieldIndex)"
                      />
                    </div>
                  </v-card-text>
                </v-card>
              </template>
            </v-card-text>
          </v-card>
        </v-col>

        <v-col v-if="isDiscordWebhook" cols="12" md="5">
          <v-card class="discord-preview" variant="flat">
            <v-card-title class="d-flex align-center ga-2 text-subtitle-1">
              <v-icon icon="mdi-discord" />
              Discord preview
            </v-card-title>

            <v-card-text v-if="discordPayload">
              <div v-if="discordPayload.content" class="discord-message mb-3">
                {{ discordPayload.content }}
              </div>

              <div
                v-for="(embed, embedIndex) in discordEmbeds"
                :key="embedIndex"
                class="discord-embed mb-3"
                :style="{ borderLeftColor: embedColor(embed.color) }"
              >
                <div v-if="embed.author?.name" class="discord-author mb-2">
                  <v-avatar v-if="embed.author?.icon_url" size="20" class="mr-2">
                    <v-img :src="embed.author.icon_url" />
                  </v-avatar>
                  <span>{{ embed.author.name }}</span>
                </div>

                <div v-if="embed.title" class="discord-title mb-1">
                  {{ embed.title }}
                </div>

                <div v-if="embed.description" class="discord-description mb-2">
                  {{ embed.description }}
                </div>

                <div v-if="Array.isArray(embed.fields) && embed.fields.length" class="discord-fields">
                  <div
                    v-for="(field, fieldIndex) in embed.fields"
                    :key="fieldIndex"
                    class="discord-field"
                    :class="{ 'discord-field--inline': field.inline }"
                  >
                    <div class="discord-field-name">{{ field.name }}</div>
                    <div class="discord-field-value">{{ field.value }}</div>
                  </div>
                </div>

                <v-img
                  v-if="embed.image?.url"
                  :src="embed.image.url"
                  class="discord-image mt-3"
                  max-height="220"
                  cover
                />

                <div v-if="embed.footer?.text" class="discord-footer mt-2">
                  {{ embed.footer.text }}
                </div>
              </div>

              <v-alert
                v-if="!discordPayload.content && discordEmbeds.length === 0"
                type="info"
                variant="tonal"
                density="comfortable"
                text="Discord webhook detected, but the body has no content or embeds."
              />
            </v-card-text>

            <v-card-text v-else>
              <v-alert
                type="warning"
                color="warning"
                variant="tonal"
                density="comfortable"
                text="Discord webhook detected, but the raw body is not valid JSON yet."
              />
            </v-card-text>
          </v-card>
        </v-col>

        <v-col v-if="contentError" cols="12">
          <v-alert
            type="warning"
            color="warning"
            variant="tonal"
            density="comfortable"
            :text="contentError"
          />
        </v-col>
      </v-row>

      <v-card-actions class="px-0 pb-0">
        <v-spacer />
        <v-btn icon="mdi-arrow-up" variant="text" size="small" @click="$emit('move-up')" />
        <v-btn icon="mdi-arrow-down" variant="text" size="small" @click="$emit('move-down')" />
        <v-btn icon="mdi-delete" color="error" variant="text" size="small" @click="$emit('remove')" />
      </v-card-actions>
    </v-expansion-panel-text>
  </v-expansion-panel>
</template>

<script lang="ts">
type DiscordEmbed = {
  title?: string
  description?: string
  color?: number | string
  author?: {
    name?: string
    icon_url?: string
  }
  fields?: Array<{
    name?: string
    value?: string
    inline?: boolean
  }>
  image?: {
    url?: string
  }
  footer?: {
    text?: string
  }
}

type DiscordPayload = {
  content?: string
  embeds?: DiscordEmbed[]
}

export default {
  name: 'MacroWebhookTaskAccordion',

  props: {
    item: { type: Object, required: true },
    index: { type: Number, required: true },
    depth: { type: Number, default: 0 },
  },

  emits: ['remove', 'move-up', 'move-down'],

  data() {
    return {
      methodOptions: ['post', 'put', 'patch'],
      rawDiscordEditor: false,
    }
  },

  computed: {
    task(): any {
      return (this.item as any).task ?? (this.item as any)
    },

    formData(): any {
      return this.task.data
    },

    methodLabel(): string {
      return String(this.task.method || 'post').toUpperCase()
    },

    isDiscordWebhook(): boolean {
      return /discord(?:app)?\.com\/api\/webhooks\//i.test(String(this.formData?.url ?? ''))
    },

    parsedContent(): any | null {
      const content = String(this.formData?.content ?? '').trim()

      if (!content) return null

      try {
        return JSON.parse(content)
      } catch (error) {
        return null
      }
    },

    contentError(): string {
      const content = String(this.formData?.content ?? '').trim()

      if (!content || this.parsedContent) return ''

      return 'Raw body is not valid JSON. It will still be sent as-is, but Discord embed preview needs valid JSON.'
    },

    canFormatContent(): boolean {
      return this.parsedContent !== null
    },

    discordPayload(): DiscordPayload | null {
      if (!this.isDiscordWebhook || !this.parsedContent || typeof this.parsedContent !== 'object' || Array.isArray(this.parsedContent)) {
        return null
      }

      return this.parsedContent as DiscordPayload
    },

    discordEmbeds(): DiscordEmbed[] {
      return Array.isArray(this.discordPayload?.embeds) ? this.discordPayload!.embeds : []
    },

    firstEmbed(): DiscordEmbed {
      return this.discordEmbeds[0] ?? {}
    },

    firstEmbedColorHex(): string {
      return this.embedColor(this.firstEmbed.color)
    },

    discordContent(): string {
      return String(this.discordPayload?.content ?? '')
    },

    discordFields(): Array<{ name?: string; value?: string; inline?: boolean }> {
      return Array.isArray(this.firstEmbed.fields) ? this.firstEmbed.fields : []
    },
  },

  created() {
    this.normalizeTask()
    this.ensureDiscordPayload()
  },

  watch: {
    item: {
      deep: true,
      handler() {
        this.normalizeTask()
      },
    },

    isDiscordWebhook(value: boolean) {
      if (value) {
        this.ensureDiscordPayload()
        this.rawDiscordEditor = false
      } else {
        this.rawDiscordEditor = true
      }
    },

    rawDiscordEditor(value: boolean) {
      if (!value) {
        this.ensureDiscordPayload()
      }
    },
  },

  methods: {
    normalizeTask() {
      if (!this.task.channel) this.task.channel = 'webhook'
      if (!this.task.method) this.task.method = 'post'
      this.task.method = String(this.task.method).toLowerCase()

      if (!this.task.data || typeof this.task.data !== 'object') {
        this.task.data = {}
      }

      if ('additional_data' in this.task.data) {
        delete this.task.data.additional_data
      }

      if ('additionalData' in this.task.data) {
        delete this.task.data.additionalData
      }

      if (this.task.data.url === undefined) {
        this.task.data.url = ''
      }

      if (this.task.data.content === undefined || this.task.data.content === null) {
        this.task.data.content = ''
      } else if (typeof this.task.data.content !== 'string') {
        this.task.data.content = JSON.stringify(this.task.data.content, null, 2)
      }
    },

    formatContent() {
      if (!this.parsedContent) return
      this.formData.content = JSON.stringify(this.parsedContent, null, 2)
    },

    minifyContent() {
      if (!this.parsedContent) return
      this.formData.content = JSON.stringify(this.parsedContent)
    },

    createEmptyDiscordPayload(): DiscordPayload {
      return {
        content: '',
        embeds: [
          {
            color: 5_793_266,
            fields: [],
          },
        ],
      }
    },

    ensureDiscordPayload() {
      if (!this.isDiscordWebhook) return

      if (!this.discordPayload) {
        this.writeDiscordPayload(this.createEmptyDiscordPayload())
        return
      }

      const payload = this.cloneDiscordPayload()

      if (!Array.isArray(payload.embeds)) {
        payload.embeds = []
      }

      if (!payload.embeds[0]) {
        payload.embeds[0] = { color: 5_793_266, fields: [] }
      }

      if (!Array.isArray(payload.embeds[0].fields)) {
        payload.embeds[0].fields = []
      }

      this.writeDiscordPayload(payload)
    },

    cloneDiscordPayload(): DiscordPayload {
      const payload = this.discordPayload ?? this.createEmptyDiscordPayload()
      return JSON.parse(JSON.stringify(payload))
    },

    writeDiscordPayload(payload: DiscordPayload) {
      this.formData.content = JSON.stringify(this.cleanupDiscordPayload(payload), null, 2)
    },

    cleanupDiscordPayload(payload: DiscordPayload): DiscordPayload {
      const clean = JSON.parse(JSON.stringify(payload ?? {}))

      if (Array.isArray(clean.embeds)) {
        clean.embeds = clean.embeds.map((embed: DiscordEmbed) => {
          const nextEmbed: any = { ...embed }

          for (const key of ['author', 'image', 'footer']) {
            if (nextEmbed[key] && Object.values(nextEmbed[key]).every(value => value === '' || value === undefined || value === null)) {
              delete nextEmbed[key]
            }
          }

          if (Array.isArray(nextEmbed.fields)) {
            nextEmbed.fields = nextEmbed.fields.filter((field: any) => field.name || field.value)
          }

          return nextEmbed
        })
      }

      return clean
    },

    setDiscordPayloadValue(key: keyof DiscordPayload, value: any) {
      const payload = this.cloneDiscordPayload()
      ;(payload as any)[key] = value
      this.writeDiscordPayload(payload)
    },

    setDiscordEmbedValue(key: keyof DiscordEmbed, value: any) {
      const payload = this.cloneDiscordPayload()
      const embed = this.getFirstEditableEmbed(payload)

      ;(embed as any)[key] = key === 'color' ? this.normalizeDiscordColor(value) : value
      this.writeDiscordPayload(payload)
    },

    setDiscordEmbedNestedValue(parentKey: 'author' | 'image' | 'footer', key: string, value: any) {
      const payload = this.cloneDiscordPayload()
      const embed = this.getFirstEditableEmbed(payload)

      ;(embed as any)[parentKey] = {
        ...((embed as any)[parentKey] ?? {}),
        [key]: value,
      }

      this.writeDiscordPayload(payload)
    },

    getFirstEditableEmbed(payload: DiscordPayload): DiscordEmbed {
      if (!Array.isArray(payload.embeds)) {
        payload.embeds = []
      }

      if (!payload.embeds[0]) {
        payload.embeds[0] = { fields: [] }
      }

      return payload.embeds[0]
    },

    addDiscordField() {
      const payload = this.cloneDiscordPayload()
      const embed = this.getFirstEditableEmbed(payload)

      if (!Array.isArray(embed.fields)) {
        embed.fields = []
      }

      embed.fields.push({ name: '', value: '', inline: false })
      this.writeDiscordPayload(payload)
    },

    updateDiscordField(index: number, key: 'name' | 'value' | 'inline', value: any) {
      const payload = this.cloneDiscordPayload()
      const embed = this.getFirstEditableEmbed(payload)

      if (!Array.isArray(embed.fields)) {
        embed.fields = []
      }

      if (!embed.fields[index]) {
        embed.fields[index] = { name: '', value: '', inline: false }
      }

      ;(embed.fields[index] as any)[key] = value
      this.writeDiscordPayload(payload)
    },

    removeDiscordField(index: number) {
      const payload = this.cloneDiscordPayload()
      const embed = this.getFirstEditableEmbed(payload)

      if (Array.isArray(embed.fields)) {
        embed.fields.splice(index, 1)
      }

      this.writeDiscordPayload(payload)
    },

    setDiscordEmbedColor(value: any) {
      this.setDiscordEmbedValue('color', value)
    },

    normalizeDiscordColor(value: any) {
      if (value && typeof value === 'object') {
        if (typeof value.hex === 'string') value = value.hex
        else if (typeof value.hexa === 'string') value = value.hexa
      }

      if (typeof value === 'string' && value.trim().startsWith('#')) {
        const parsed = Number.parseInt(value.trim().replace(/^#/, ''), 16)
        return Number.isFinite(parsed) ? parsed : value
      }

      const parsed = Number(value)
      return Number.isFinite(parsed) ? parsed : value
    },

    embedColor(color: any) {
      const value = this.normalizeDiscordColor(color)

      if (!Number.isFinite(Number(value))) {
        return '#5865f2'
      }

      return `#${Number(value).toString(16).padStart(6, '0').slice(-6)}`
    },
  },
}
</script>

<style scoped>
.webhook-content-input :deep(textarea) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
}

.discord-preview {
  position: sticky;
  top: 84px;
  background: #313338;
  color: #dbdee1;
}

.discord-message {
  white-space: pre-wrap;
  word-break: break-word;
}

.discord-embed {
  max-width: 720px;
  background: #2b2d31;
  border-left: 4px solid #5865f2;
  border-radius: 4px;
  padding: 12px;
}

.discord-author {
  display: flex;
  align-items: center;
  font-size: .875rem;
  font-weight: 600;
}

.discord-title {
  color: #f2f3f5;
  font-weight: 700;
}

.discord-description,
.discord-field-value {
  color: #dbdee1;
  white-space: pre-wrap;
  word-break: break-word;
}

.discord-fields {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.discord-field {
  flex: 1 1 100%;
  min-width: 0;
}

.discord-field--inline {
  flex: 1 1 180px;
}

.discord-field-name {
  color: #f2f3f5;
  font-size: .875rem;
  font-weight: 700;
  margin-bottom: 2px;
}

.discord-footer {
  color: #949ba4;
  font-size: .75rem;
}

.discord-image {
  border-radius: 4px;
}

.discord-field-editor-grid {
  display: grid;
  grid-template-columns: minmax(160px, 1fr) minmax(220px, 1fr) auto 40px;
  gap: 12px;
  align-items: center;
}

.discord-field-inline-toggle {
  min-width: 86px;
  white-space: nowrap;
}

.discord-field-inline-toggle :deep(.v-label) {
  white-space: nowrap;
}

.discord-field-delete {
  justify-self: end;
}

@media (max-width: 960px) {
  .discord-field-editor-grid {
    grid-template-columns: 1fr;
  }

  .discord-field-inline-toggle,
  .discord-field-delete {
    justify-self: start;
  }
}

.discord-color-swatch {
  width: 20px;
  height: 20px;
  border-radius: 50%;
}
</style>
