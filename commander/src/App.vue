<template>
  <v-app>
    <template v-if="updating">
      <v-card color="transparent" rounded="0" flat class="boot-root">
        <v-layout class="boot-layout">
          <!-- background -->
          <div class="boot-bg" aria-hidden="true">
          </div>

          <!-- content -->
          <v-card class="boot-card" rounded="xl" elevation="12">
            <v-card-text class="pa-8 pa-md-10">
              <div class="d-flex align-center justify-space-between">
                <div class="d-flex align-center ga-4">

                  <div>
                    <div class="text-h5 font-weight-bold">System Updating</div>
                    <div class="text-body-2 text-medium-emphasis">
                      Please wait while the system is updating…
                    </div>
                  </div>
                </div>
              </div>
            </v-card-text>
          </v-card>
        </v-layout>
      </v-card>
    </template>

    <template v-else-if="ready">
      <v-card color="transparent" rounded="0">
        <v-layout style="min-height: 100vh; max-height: 100vh">
          <Navigation />
          <router-view />
        </v-layout>
      </v-card>
      <ConnectDialog />
      <PowerDialog />
    </template>

    <template v-else>
      <v-card color="transparent" rounded="0" flat class="boot-root">
        <v-layout class="boot-layout">
          <!-- background -->
          <div class="boot-bg" aria-hidden="true">
          </div>

          <!-- content -->
          <v-card class="boot-card" rounded="xl" elevation="12">
            <v-card-text class="pa-8 pa-md-10">
              <div class="d-flex align-center justify-space-between mb-6">
                <div class="d-flex align-center ga-4">

                  <div>
                    <div class="text-h5 font-weight-bold">System Booting</div>
                    <div class="text-body-2 text-medium-emphasis">
                      Please wait while services initialize…
                    </div>
                  </div>
                </div>
              </div>

              <div class="d-flex align-center ga-4">
                <div class="text-body-2">
                  <span class="text-medium-emphasis">Stage:</span>
                  <span class="font-weight-medium ms-2">{{ stage ?? "Unknown" }}</span>
                </div>
              </div>
            </v-card-text>
          </v-card>
        </v-layout>
      </v-card>
    </template>
  </v-app>
</template>

<script lang="ts" setup>
import { useAppStore } from '@/stores/app'
import WebsocketClient from "@/plugins/webSocketClient"
import eventBus from "@/eventBus"
import { sleep } from "@/helper/GeneralHelper.ts"
import { setI18nLanguageFromConfig } from '@/plugins/i18n'
import { getWebsocketClient, setWebsocketClient } from "@/plugins/websocketInstance"

const appOption = useAppStore()
setI18nLanguageFromConfig(appOption.getLanguage)

const ready = ref<boolean | undefined>(false)
const updating = ref<boolean | undefined>(false)
const stage = ref<string | undefined>('Unknown')

if(window.location.hostname === 'localhost') {
  ready.value = true
}

eventBus.$on('websocket:reconnect', () => {
  void getWebsocketClient()?.connect()
})

eventBus.$on('websocket:send', (data) => {
  if(data.method === 'update') {
    updating.value = true // this doesnt seem to trigger?
  }
  console.warn(`detected legacy send use: ${data.method}`)
  getWebsocketClient()?.send(data.method, data.params)
})

eventBus.$on('websocket:request', async (data) => {
  console.warn(`detected legacy request use: ${data.method}`)
  if (!getWebsocketClient()) {
    data?.reject?.(new Error('websocket is not connected'))
    return
  }

  try {
    const result = (await getWebsocketClient()?.request(data.method, data.params ?? {}, data.timeout ?? 10_000))?.params
    data?.resolve?.(result)
  } catch (error) {
    data?.reject?.(error)
  }
})

onMounted(async () => {
  await appOption.fetchConfig()

  if(window.location.hostname !== 'localhost') {
    let isReady = (await appOption.fetchStatus()).ready
    if (!isReady) {
      do {
        const status = await appOption.fetchStatus()
        stage.value = status.bootup_stage
        isReady = status.ready
        await sleep(250)
      } while (!isReady)
    }
  }

  await appOption.fetchGames()

  setWebsocketClient(new WebsocketClient(appOption.getWebsocket, appOption))
  await getWebsocketClient()?.connect()

  ready.value = true
})
</script>

<style>
html {
  overflow: hidden;
}
</style>

<style scoped>
.boot-root {
  min-height: 100vh;
}

.boot-layout {
  min-height: 100vh;
  position: relative;
  overflow: hidden;
  display: grid;
  place-items: center;
  padding: 24px;
}

/* Background */
.boot-bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(circle at top left, transparent 9%, #3A0045 10%, #3A0045 15%, transparent 16%),
    radial-gradient(circle at bottom left, transparent 9%, #3A0045 10%, #3A0045 15%, transparent 16%),
    radial-gradient(circle at top right, transparent 9%, #3A0045 10%, #3A0045 15%, transparent 16%),
    radial-gradient(circle at bottom right, transparent 9%, #3A0045 10%, #3A0045 15%, transparent 16%),
    radial-gradient(circle, transparent 25%, #000000 26%),
    linear-gradient(45deg, transparent 46%, #3A0045 47%, #3A0045 52%, transparent 53%),
    linear-gradient(135deg, transparent 46%, #3A0045 47%, #3A0045 52%, transparent 53%);
  background-size: 3em 3em;
  background-color: #000000;
  opacity: 1;

  animation: rainbow-cycle 12s linear infinite;
}

@keyframes rainbow-cycle {
  from {
    filter: hue-rotate(0deg);
  }
  to {
    filter: hue-rotate(360deg);
  }
}

/* Card */
.boot-card {
  width: min(620px, 92vw);
  border: 1px solid rgba(255,255,255,0.10);
  background: rgba(18, 18, 22, 0.8);
  backdrop-filter: blur(14px);
}
</style>
