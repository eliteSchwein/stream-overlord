<script setup lang="ts">
import { ref } from "vue";
//import { invoke } from "@tauri-apps/api/core";

//const greetMsg = ref("");
//const name = ref("");

const targetAddress = ref<string>("http://localhost:8105");

const ready = ref<boolean | undefined>(false)
const updating = ref<boolean | undefined>(false)
const stage = ref<string | undefined>('Unknown')

//async function greet() {
//  // Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
//  greetMsg.value = await invoke("greet", { name: name.value });
//}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchStatus() {
  let status = {
    bootup_stage: 'Unknown',
    ready: false,
  }

  try {
    status = (await (await fetch(`${targetAddress.value}/api/status`, { cache: "no-store" })).json()).data
  } catch (e) {
    console.warn(e)
  }

  return status
}

async function init() {
  // watchdog if bot running
  setInterval(async () => {
    if(!ready.value) return

    const isPresent = (await fetchStatus()).ready ?? false

    if(isPresent) return

    ready.value = false
    await bootupSequence()
  }, 1_000)
  await bootupSequence()
}

async function bootupSequence() {
  stage.value = 'Unknown'

  let isReady = (await fetchStatus()).ready ?? false
  if(!isReady) {
    ready.value = false
    do {
      const status = await fetchStatus()
      stage.value = status.bootup_stage
      isReady = status.ready
      await sleep(250)
    } while (!isReady)
  }

  ready.value = true
}

void init()
</script>

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
      <iframe :src="`${targetAddress}/commander`"></iframe>
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


<style scoped>
iframe {
  height: 100vh;
  width: 100%;
  border: none;
}
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

<style>
html {
  overflow: hidden;
}
</style>