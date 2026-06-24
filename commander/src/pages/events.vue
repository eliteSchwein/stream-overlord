<template>
  <v-card class="overflow-auto mx-auto" max-height="100%" elevation="0" color="transparent" max-width="100%">
    <v-card-title class="d-flex align-center justify-space-between px-3 pt-3">
      <div class="d-flex align-center ga-2 min-width-0">
        <v-icon icon="mdi-lightning-bolt" />
        <div class="min-width-0">
          <div class="text-truncate">{{ $t('events.title') || 'Events' }}</div>
        </div>
      </div>

      <v-btn icon="mdi-refresh" variant="text" :loading="loading" @click="refreshEvents" />
    </v-card-title>

    <v-card-text>
      <v-text-field
        v-model="searchQuery"
        :label="$t('events.search') || 'Search events'"
        prepend-inner-icon="mdi-magnify"
        clearable
        variant="outlined"
        density="comfortable"
        hide-details
        class="mb-3"
      />

      <v-alert v-if="errorMessage" type="error" color="red-darken-3" class="mb-4" :text="errorMessage" />
      <v-alert v-if="totalEvents === 0" type="info" color="warning" :text="$t('events.none') || 'No events found'" />

      <v-expansion-panels v-else variant="accordion" multiple class="event-channel-list">
        <v-expansion-panel
          v-for="channelGroup in filteredNestedEvents"
          :key="channelGroup.name"
          bg-color="grey-darken-4"
        >
          <v-expansion-panel-title>
            <div class="d-flex align-center ga-2 min-width-0 w-100">
              <v-icon :icon="channelIcon(channelGroup.name)" />
              <span class="text-truncate text-capitalize">{{ channelGroup.name }}</span>
              <v-chip size="x-small" variant="tonal">{{ channelGroup.count }}</v-chip>
            </div>
          </v-expansion-panel-title>

          <v-expansion-panel-text>
            <v-expansion-panels
              v-if="channelGroup.hasSubchannels"
              variant="accordion"
              multiple
              class="event-subchannel-list"
            >
              <v-expansion-panel
                v-for="subchannelGroup in channelGroup.subchannels"
                :key="`${channelGroup.name}_${subchannelGroup.name}`"
                bg-color="grey-darken-3"
              >
                <v-expansion-panel-title>
                  <div class="d-flex align-center ga-2 min-width-0 w-100">
                    <v-icon icon="mdi-folder-outline" />
                    <span class="text-truncate text-capitalize">{{ subchannelGroup.name }}</span>
                    <v-chip size="x-small" variant="tonal">{{ subchannelGroup.events.length }}</v-chip>
                  </div>
                </v-expansion-panel-title>

                <v-expansion-panel-text>
                  <v-list class="event-entry-list" bg-color="transparent">
                    <EventEntry
                      v-for="(eventEntry, eventIndex) in subchannelGroup.events"
                      :key="eventEntry.configName"
                      :class="eventIndex % 2 === 0 ? 'event-entry-row--even' : 'event-entry-row--odd'"
                      :event-entry="eventEntry"
                      :disabled="workingAction !== null"
                      @edit="openEditDialog"
                    />
                  </v-list>
                </v-expansion-panel-text>
              </v-expansion-panel>
            </v-expansion-panels>

            <v-list v-else class="event-entry-list" bg-color="transparent">
              <EventEntry
                v-for="(eventEntry, eventIndex) in channelGroup.events"
                :key="eventEntry.configName"
                :class="eventIndex % 2 === 0 ? 'event-entry-row--even' : 'event-entry-row--odd'"
                :event-entry="eventEntry"
                :disabled="workingAction !== null"
                @edit="openEditDialog"
              />
            </v-list>
          </v-expansion-panel-text>
        </v-expansion-panel>
      </v-expansion-panels>
    </v-card-text>

    <EventEditorDialog
      ref="editorDialog"
      v-model="editorDialog"
      :event-entry="selectedEvent"
      :loading="workingAction === 'save'"
      :error="editorError"
      @save="saveEvent"
    />
  </v-card>
</template>

<script lang="ts">
import { getWebsocketClient } from '@/plugins/websocketInstance'
import EventEntry from '@/components/EventEntry.vue'
import EventEditorDialog from '@/components/dialogs/EventEditorDialog.vue'

type EventEntryData = {
  name: string
  channel: string
  subchannel?: string
  configName: string
  macro?: boolean
  asset?: boolean
  configured?: boolean
  raw?: any
}

type EventSubchannelGroup = {
  name: string
  events: EventEntryData[]
}

type EventChannelGroup = {
  name: string
  count: number
  events: EventEntryData[]
  subchannels: EventSubchannelGroup[]
  hasSubchannels: boolean
}

export default {
  name: 'Events',

  components: {
    EventEntry,
    EventEditorDialog,
  },

  data() {
    return {
      loading: false,
      errorMessage: '',
      editorError: '',
      searchQuery: '',
      events: {} as Record<string, EventEntryData[]>,
      configuredEvents: {} as Record<string, EventEntryData[]>,
      selectedEvent: null as EventEntryData | null,
      editorDialog: false,
      workingAction: null as null | 'save',
    }
  },

  computed: {
    eventList(): EventEntryData[] {
      const entries = this.normalizeEvents(this.configuredEvents).length
        ? this.normalizeEvents(this.configuredEvents)
        : this.normalizeEvents(this.events)

      return entries.sort((a, b) => a.configName.localeCompare(b.configName))
    },

    totalEvents(): number {
      return this.filteredEventList.length
    },

    filteredEventList(): EventEntryData[] {
      const query = String(this.searchQuery ?? '').trim().toLowerCase()
      if (!query) return this.eventList

      return this.eventList.filter((eventEntry) =>
        [eventEntry.name, eventEntry.channel, eventEntry.subchannel, eventEntry.configName]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query)),
      )
    },

    filteredNestedEvents(): EventChannelGroup[] {
      const channels = new Map<string, Map<string, EventEntryData[]>>()

      for (const eventEntry of this.filteredEventList) {
        const channel = String(eventEntry.channel || 'system')
        const subchannel = String(eventEntry.subchannel || '').trim()

        if (!channels.has(channel)) channels.set(channel, new Map())
        if (!channels.get(channel)!.has(subchannel)) channels.get(channel)!.set(subchannel, [])

        channels.get(channel)!.get(subchannel)!.push(eventEntry)
      }

      return [...channels.entries()].map(([name, subchannels]) => {
        const groups = [...subchannels.entries()].map(([subchannelName, events]) => ({
          name: subchannelName,
          events: events.sort((a, b) => a.configName.localeCompare(b.configName)),
        }))

        const realSubchannels = groups
          .filter((group) => group.name && group.name !== name)
          .sort((a, b) => a.name.localeCompare(b.name))

        const directEvents = groups
          .filter((group) => !group.name || group.name === name)
          .flatMap((group) => group.events)
          .sort((a, b) => a.configName.localeCompare(b.configName))

        return {
          name,
          count: groups.reduce((count, group) => count + group.events.length, 0),
          events: directEvents,
          subchannels: realSubchannels,
          hasSubchannels: realSubchannels.length > 0,
        }
      }).sort((a, b) => a.name.localeCompare(b.name))
    },
  },

  mounted() {
    this.refreshEvents()
  },

  methods: {
    async requestWebsocket(method: string, params: Record<string, any> = {}, timeout = 15_000): Promise<any> {
      const client = getWebsocketClient()

      if (!client) {
        throw new Error('websocket is not connected')
      }

      const response = await client.request(method, params, timeout)
      return response?.params ?? response
    },

    getWebsocketResultKey(method: string) {
      return `result_${String(method ?? '').replace(/[^a-zA-Z0-9_]/g, '_')}`
    },

    unwrapWebsocketResponse(response: any, method = ''): any {
      const resultKey = method ? this.getWebsocketResultKey(method) : ''
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

    assertWebsocketResponse(data: any, fallbackMessage: string) {
      if (data?.error) {
        throw new Error(data.error)
      }

      if (data?.success === false) {
        throw new Error(data?.message ?? fallbackMessage)
      }

      return data
    },

    async requestEventEndpoint(method: string, params: Record<string, any> = {}, timeout = 15_000): Promise<any> {
      const response = await this.requestWebsocket(method, params, timeout)
      const data = this.unwrapWebsocketResponse(response, method)
      return this.assertWebsocketResponse(data, `${method} failed`)
    },

    normalizeEvents(value: any): EventEntryData[] {
      if (Array.isArray(value)) {
        return value.map(this.normalizeEventEntry).filter(Boolean) as EventEntryData[]
      }

      if (value && typeof value === 'object') {
        return Object.entries(value).flatMap(([channel, entries]: [string, any]) => {
          const list = Array.isArray(entries) ? entries : []
          return list.map((entry: any) => this.normalizeEventEntry({ channel, ...entry })).filter(Boolean) as EventEntryData[]
        })
      }

      return []
    },

    normalizeEventEntry(raw: any): EventEntryData | null {
      const configName = String(raw?.configName ?? raw?.config_name ?? raw?.name ?? '').trim()
      if (!configName) return null

      const parsed = this.parseConfigName(configName)

      return {
        name: String(raw?.name ?? parsed.name),
        channel: String(raw?.channel ?? parsed.channel),
        subchannel: String(raw?.subchannel ?? raw?.subChannel ?? parsed.subchannel ?? ''),
        configName,
        macro: raw?.macro === true,
        asset: raw?.asset === true,
        configured: raw?.configured === true || raw?.macro === true || raw?.asset === true,
        raw,
      }
    },

    parseConfigName(configName: string) {
      const parts = String(configName ?? '').split('_').filter(Boolean)
      if (parts[0] === 'event') parts.shift()

      const channel = parts.shift() || 'system'
      return {
        channel,
        subchannel: '',
        name: parts.join('_') || channel,
      }
    },

    async refreshEvents() {
      this.loading = true
      this.errorMessage = ''

      try {
        const data = await this.requestEventEndpoint('events_list')
        if (data?.error) throw new Error(data.error)

        this.events = data?.events ?? {}
        this.configuredEvents = data?.configured_events ?? data?.configuredEvents ?? {}
      } catch (error: any) {
        this.errorMessage = error?.message ?? 'loading events failed'
      } finally {
        this.loading = false
      }
    },

    async openEditDialog(eventEntry: EventEntryData) {
      this.selectedEvent = eventEntry
      this.editorError = ''
      this.editorDialog = true
      await this.$nextTick()
      await (this.$refs.editorDialog as any)?.open?.()
    },

    async saveEvent(payload: any) {
      const name = String(payload?.name ?? '').trim()
      if (!name || this.workingAction) return

      this.workingAction = 'save'
      this.editorError = ''

      try {
        if (!payload.skipAsset) {
          await this.requestEventEndpoint('assets_edit', {
            path: `${name}.yaml`,
            name,
            asset: payload.asset ?? {},
          }, 30_000)
        }

        await this.requestEventEndpoint('macro_edit', {
          path: `${name}.yaml`,
          name,
          content: payload.macroContent ?? this.defaultMacroContent(name),
        }, 30_000)

        this.editorDialog = false
        await this.refreshEvents()
      } catch (error: any) {
        this.editorError = error?.message ?? 'saving event failed'
      } finally {
        this.workingAction = null
      }
    },

    defaultMacroContent(name: string) {
      return `name: ${name}\napis: []\ntasks: []\n`
    },

    channelIcon(channel: string) {
      if (channel === 'twitch') return 'mdi-twitch'
      if (channel === 'system') return 'mdi-power'
      return 'mdi-lightning-bolt'
    },
  },
}
</script>

<style scoped lang="scss">
.min-width-0 {
  min-width: 0;
}

.w-100 {
  width: 100%;
}

.event-entry-list {
  padding: 4px 0;
}

.event-entry-list :deep(.event-entry-row--even) {
  background: rgba(var(--v-theme-surface), 0.18) !important;
}

.event-entry-list :deep(.event-entry-row--odd) {
  background: rgba(var(--v-theme-primary), 0.10) !important;
}

</style>
