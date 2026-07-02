<template>
  <v-card class="overflow-auto mx-auto" max-height="100%" elevation="0" color="transparent" max-width="100%">
    <v-card-title class="d-flex align-center justify-space-between px-3 pt-3">
      <div class="d-flex align-center ga-2">
        <v-icon icon="mdi-connection" />
        <span>Integrations</span>
      </div>
    </v-card-title>

    <v-card-text>
      <v-row density="comfortable">
        <v-col cols="12" lg="6">
          <v-card color="grey-darken-4" elevation="0">
            <v-card-title class="d-flex align-center ga-2">
              <v-icon icon="mdi-twitch" />
              <span>Twitch</span>
            </v-card-title>

            <v-card-text>
              <v-row density="comfortable">
                <v-col cols="12" md="6">
                  <v-card variant="tonal">
                    <v-card-title class="d-flex align-center justify-space-between text-subtitle-1">
                      <span>Control Auth</span>
                      <v-chip
                        size="x-small"
                        :color="twitchStatus.control ? 'success' : 'warning'"
                        variant="tonal"
                      >
                        {{ twitchStatus.control ? 'Logged in' : 'Missing' }}
                      </v-chip>
                    </v-card-title>

                    <v-card-text>
                      Full access auth for EventSub, channel points, moderation and API actions.
                    </v-card-text>

                    <v-card-actions>
                      <v-btn
                        color="primary"
                        variant="flat"
                        prepend-icon="mdi-login"
                        @click="openTwitchAuth('control')"
                      >
                        Auth control
                      </v-btn>
                    </v-card-actions>
                  </v-card>
                </v-col>

                <v-col cols="12" md="6">
                  <v-card variant="tonal">
                    <v-card-title class="d-flex align-center justify-space-between text-subtitle-1">
                      <span>Message Auth</span>
                      <v-chip
                        size="x-small"
                        :color="twitchStatus.message ? 'success' : 'grey'"
                        variant="tonal"
                      >
                        {{ twitchStatus.message ? 'Logged in' : 'Optional' }}
                      </v-chip>
                    </v-card-title>

                    <v-card-text>
                      Optional auth for chat messages, replies, whispers and announcements.
                    </v-card-text>

                    <v-card-actions>
                      <v-btn
                        color="secondary"
                        variant="flat"
                        prepend-icon="mdi-message-text-outline"
                        @click="openTwitchAuth('message')"
                      >
                        Auth message
                      </v-btn>
                    </v-card-actions>
                  </v-card>
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>
        </v-col>

        <v-col cols="12" lg="6">
          <v-card color="grey-darken-4" elevation="0">
            <v-card-title class="d-flex align-center justify-space-between">
              <div class="d-flex align-center ga-2">
                <v-icon icon="mdi-led-strip-variant" />
                <span>WLED</span>
              </div>

              <v-chip size="small" variant="tonal">
                {{ wledEntries.length }}
              </v-chip>
            </v-card-title>

            <v-card-text>
              <v-row density="comfortable">
                <v-col cols="12" md="5">
                  <v-text-field
                    v-model="wledForm.name"
                    label="Name"
                    placeholder="desk"
                    density="compact"
                    variant="outlined"
                    hide-details
                  />
                </v-col>

                <v-col cols="12" md="5">
                  <v-text-field
                    v-model="wledForm.ip"
                    label="IP / Host"
                    placeholder="192.168.178.50"
                    density="compact"
                    variant="outlined"
                    hide-details
                    @keydown.enter="addWled"
                  />
                </v-col>

                <v-col cols="12" md="2">
                  <v-btn
                    block
                    color="primary"
                    variant="flat"
                    prepend-icon="mdi-plus"
                    :loading="loading.wledAdd"
                    :disabled="!canAddWled"
                    @click="addWled"
                  >
                    Add
                  </v-btn>
                </v-col>
              </v-row>

              <v-divider class="my-4" />

              <v-alert
                v-if="!wledEntries.length"
                type="info"
                variant="tonal"
                density="compact"
              >
                No WLED integrations configured yet.
              </v-alert>

              <v-list v-else bg-color="transparent" density="compact">
                <v-list-item
                  v-for="entry in wledEntries"
                  :key="entry.name"
                  rounded
                  class="mb-2 bg-grey-darken-3"
                >
                  <template #prepend>
                    <v-avatar color="primary" variant="tonal">
                      <v-icon icon="mdi-led-strip-variant" />
                    </v-avatar>
                  </template>

                  <v-list-item-title>
                    {{ entry.name }}
                  </v-list-item-title>

                  <v-list-item-subtitle>
                    {{ entry.ip }}
                  </v-list-item-subtitle>

                  <template #append>
                    <v-btn
                      icon="mdi-delete-outline"
                      color="error"
                      variant="text"
                      :loading="loading.wledRemove === entry.name"
                      @click="removeWled(entry.name)"
                    />
                  </template>
                </v-list-item>
              </v-list>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </v-card-text>

    <v-snackbar
      v-model="snackbar.show"
      :color="snackbar.color"
      timeout="2500"
    >
      {{ snackbar.text }}
    </v-snackbar>
  </v-card>
</template>

<script lang="ts">
import { useAppStore } from '@/stores/app'

type TwitchAuthType = 'control' | 'message'

export default {
  name: 'IntegrationsPage',

  data() {
    return {
      appStore: useAppStore(),

      wledForm: {
        name: '',
        ip: '',
      },

      loading: {
        wledAdd: false,
        wledRemove: '',
      },

      snackbar: {
        show: false,
        text: '',
        color: 'success',
      },
    }
  },

  computed: {
    integrations(): any {
      return this.appStore.getIntegrations ?? {}
    },

    wledIntegrations(): Record<string, any> {
      return this.integrations?.wled ?? {}
    },

    wledEntries(): any[] {
      return Object.entries(this.wledIntegrations)
        .map(([name, data]: any) => ({
          name,
          ip: data?.ip ?? '',
        }))
        .sort((a, b) => a.name.localeCompare(b.name))
    },

    integrationCount(): number {
      return Object.keys(this.wledIntegrations).length + 1
    },

    canAddWled(): boolean {
      return Boolean(this.wledForm.name.trim() && this.wledForm.ip.trim())
    },

    twitchStatus(): { control: boolean; message: boolean } {
      return {
        control: Boolean(this.integrations?.twitch?.control),
        message: Boolean(this.integrations?.twitch?.message),
      }
    },
  },

  methods: {
    getWebsocket(): WebSocket | null {
      const candidates = [
        (window as any).websocket,
        (window as any).ws,
        (window as any).webSocket,
        (window as any).socket,
      ]

      for (const candidate of candidates) {
        if (candidate && candidate.readyState === WebSocket.OPEN) {
          return candidate
        }
      }

      return null
    },

    sendWebsocket(method: string, params: any = {}) {
      const websocket = this.getWebsocket()

      if (!websocket) {
        this.showError('WebSocket is not connected')
        return false
      }

      websocket.send(JSON.stringify({
        jsonrpc: '2.0',
        method,
        params,
        id: Date.now(),
      }))

      return true
    },

    addWled() {
      const name = this.wledForm.name.trim()
      const ip = this.wledForm.ip.trim()

      if (!name || !ip) {
        this.showError('Name and IP are required')
        return
      }

      this.loading.wledAdd = true

      const sent = this.sendWebsocket('wled_add', {
        name,
        ip,
      })

      this.loading.wledAdd = false

      if (!sent) return

      this.wledForm.name = ''
      this.wledForm.ip = ''
      this.showSuccess('WLED add request sent')
    },

    removeWled(name: string) {
      if (!name) return

      this.loading.wledRemove = name

      const sent = this.sendWebsocket('wled_remove', {
        name,
      })

      this.loading.wledRemove = ''

      if (!sent) return

      this.showSuccess('WLED remove request sent')
    },

    openTwitchAuth(type: TwitchAuthType) {
      const returnTo = encodeURIComponent(window.location.href)

      window.location.href = `${this.appStore.getRestApi}/api/auth/twitch?type=${type}&returnTo=${returnTo}`
    },

    showSuccess(text: string) {
      this.snackbar = {
        show: true,
        text,
        color: 'success',
      }
    },

    showError(text: string) {
      this.snackbar = {
        show: true,
        text,
        color: 'error',
      }
    },
  },
}
</script>
