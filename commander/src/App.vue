<template>
  <v-app>
    <template v-if="updating">
      <v-card color="transparent" rounded="0" flat class="boot-root">
        <v-layout class="boot-layout">
          <!-- background -->
          <div class="boot-bg" aria-hidden="true">
            <div class="orb" />
            <div class="grid" />
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
            <div class="orb" />
            <div class="grid" />
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

const appOption = useAppStore()
let websocket: WebsocketClient | undefined = undefined

const ready = ref<boolean | undefined>(false)
const updating = ref<boolean | undefined>(false)
const stage = ref<string | undefined>('Unknown')

eventBus.$on('websocket:reconnect', () => {
  if (!websocket) return
  void websocket.connect()
})

eventBus.$on('websocket:send', (data) => {
  if(data.method === 'update') {
    console.log(data.method)
    updating.value = true // this doesnt seem to trigger?
  }
  websocket?.send(data.method, data.params)
})

onMounted(async () => {
  await appOption.fetchConfig()

  let isReady = (await appOption.fetchStatus()).ready
  if (!isReady) {
    do {
      const status = await appOption.fetchStatus()
      stage.value = status.bootup_stage
      isReady = status.ready
      await sleep(250)
    } while (!isReady)
  }

  await appOption.fetchGames()

  websocket = new WebsocketClient(appOption.getWebsocket, appOption)
  await websocket.connect()

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
}

.orb {
  position: absolute;
  width: 820px;
  height: 820px;
  border-radius: 999px;

  background: radial-gradient(circle at 30% 30%,
  rgba(255, 80, 80, 0.55),
  rgba(255, 80, 80, 0.20) 40%,
  transparent 70%
  );

  left: 50%;
  top: 50%;
  opacity: 0.65;

  filter: blur(72px) saturate(2) hue-rotate(0deg);

  animation:
    orb-hue 10s linear infinite,
    orb-roam 25s ease-in-out infinite;
}

.orb::after {
  content: "";
  position: absolute;
  inset: -18%;
  border-radius: 999px;

  background: radial-gradient(circle at 70% 45%,
  rgba(255, 80, 80, 0.35),
  transparent 62%
  );

  opacity: 0.8;
  filter: blur(92px) saturate(2.2);

  animation: orb-roam-2 28s ease-in-out infinite;
}

.grid {
  position: absolute;
  inset: -2px;
  opacity: 0.14;
  background:
    linear-gradient(to right, rgba(255,255,255,0.08) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px);
  background-size: 48px 48px;
  mask-image: radial-gradient(circle at 50% 46%,
  rgba(0,0,0,0.9),
  rgba(0,0,0,0.25) 60%,
  transparent 78%);
}

/* Card */
.boot-card {
  width: min(620px, 92vw);
  border: 1px solid rgba(255,255,255,0.10);
  background: rgba(18, 18, 22, 0.65);
  backdrop-filter: blur(14px);
}

/* Animate the hue variable */
@keyframes orb-hue {
  0%   { filter: blur(72px) saturate(2) hue-rotate(0deg); }
  100% { filter: blur(72px) saturate(2) hue-rotate(360deg); }
}

/* Roam across the whole viewport (big vh travel) */
@keyframes orb-roam {
  0%   { transform: translate3d(-50%, -50%, 0) translate3d(  0vw,   0vh, 0) scale(1.02); }
  16%  { transform: translate3d(-50%, -50%, 0) translate3d(-45vw, -40vh, 0) scale(1.10); }
  34%  { transform: translate3d(-50%, -50%, 0) translate3d( 46vw, -42vh, 0) scale(1.06); }
  52%  { transform: translate3d(-50%, -50%, 0) translate3d( 48vw,  42vh, 0) scale(1.12); }
  70%  { transform: translate3d(-50%, -50%, 0) translate3d(-46vw,  44vh, 0) scale(1.07); }
  100% { transform: translate3d(-50%, -50%, 0) translate3d(  0vw,   0vh, 0) scale(1.02); }
}

@keyframes orb-roam-2 {
  0%   { transform: translate3d(-50%, -50%, 0) translate3d( 18vw, -20vh, 0) scale(1.12); }
  33%  { transform: translate3d(-50%, -50%, 0) translate3d(-34vw,  38vh, 0) scale(1.22); }
  66%  { transform: translate3d(-50%, -50%, 0) translate3d( 40vw,  10vh, 0) scale(1.14); }
  100% { transform: translate3d(-50%, -50%, 0) translate3d( 18vw, -20vh, 0) scale(1.12); }
}
</style>
