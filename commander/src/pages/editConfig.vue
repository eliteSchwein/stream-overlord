<template>
  <v-card
    class="overflow-auto mx-auto"
    max-height="100%"
    max-width="100%"
    elevation="0"
    color="transparent"
    min-height="100%"
  >
    <v-row class="mx-3 my-2 mb-0 pb-0">
      <v-col cols="12" md="7" xl="9">
        <v-card class="sticky pa-0" color="transparent" elevation="0">
          <v-toolbar flat density="compact">
            <v-toolbar-title class="d-flex align-center">
              Bot Konfiguration
            </v-toolbar-title>

            <v-btn
              prepend-icon="mdi-content-save"
              color="grey-darken-3"
              variant="flat"
              elevation="0"
              @click="saveConfig"
            >
              Speichern
            </v-btn>
          </v-toolbar>

          <v-card-text class="pa-0">
            <v-textarea
              ref="configTextarea"
              class="my-0"
              style="min-height: calc(100vh - 110px);"
              v-model="backendConfigText"
              variant="outlined"
              @keyup="updateCursor"
              @click="updateCursor"
              @select="updateCursor"
              @focus="updateCursor"
              @input="updateCursor"
            />
          </v-card-text>

          <!-- optional debug -->
          <v-card-text class="py-2">
            <div class="text-caption">
              Cursor: {{ cursorPos }} | Selection: {{ selection.start }}–{{ selection.end }}
            </div>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="5" xl="3">
        <v-card elevation="0">
          <v-toolbar flat density="compact">
            <v-toolbar-title class="d-flex align-center">
              Diverse System Funktionen
            </v-toolbar-title>
          </v-toolbar>

          <v-card-text class="pa-0">
            <v-row
              align-content="center"
              justify="center"
              align="center"
              dense
              class="pa-3"
            >
              <v-col cols="12">
                <v-btn
                  width="100%"
                  :prepend-icon="getTestMode ? 'mdi-test-tube' : 'mdi-test-tube-off'"
                  :color="getTestMode ? 'orange-darken-2' : 'grey-darken-3'"
                  variant="flat"
                  elevation="0"
                  @click="toggleTestMode"
                >
                  Test Modus
                </v-btn>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>

        <v-card elevation="0" class="mt-3">
          <v-toolbar flat density="compact">
            <v-toolbar-title class="d-flex align-center">
              Standart Makros
            </v-toolbar-title>
          </v-toolbar>

          <v-card-text class="pa-0">
            <v-row
              align-content="center"
              justify="center"
              align="center"
              dense
              class="pa-3"
            >
              <v-col cols="12">
                <v-btn
                  width="100%"
                  prepend-icon="mdi-pause"
                  color="grey-darken-3"
                  variant="flat"
                  elevation="0"
                  @click="copyToClipboard('- ' + JSON.stringify({channel: 'function', method: 'sleep', data:{time:250}}) +'\n')"
                >
                  250ms Pause
                </v-btn>
              </v-col>

              <v-col cols="12">
                <v-btn
                  width="100%"
                  prepend-icon="mdi-pause"
                  color="grey-darken-3"
                  variant="flat"
                  elevation="0"
                  @click="copyToClipboard('- ' + JSON.stringify({channel: 'function', method: 'sleep', data:{time:1000}}) +'\n')"
                >
                  1s Pause
                </v-btn>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>

        <template v-if="getParsedBackendConfig?.yolobox?.enable">
          <YoloboxSettings/>
        </template>
        <template v-if="getParsedBackendConfig?.obs?.ip">
          <OBSSettings/>
        </template>

        <v-card class="mt-3" color="transparent" elevation="0">
          <v-toolbar flat density="compact">
            <v-toolbar-title class="d-flex align-center">
              Verfügbare Stimmen
            </v-toolbar-title>
          </v-toolbar>

          <v-card-text class="pa-0">
            <v-expansion-panels color="grey-darken-4">
              <v-expansion-panel
                v-for="(voices, voiceLanguage) in getVoices"
                :key="voiceLanguage"
              >
                <v-expansion-panel-title>
                  {{ voiceLanguage }}
                </v-expansion-panel-title>

                <v-expansion-panel-text class="pa-0">
                  <v-table class="wrap-anywhere">
                    <tbody>
                    <tr v-for="voice in voices" :key="voice">
                      <td>{{ voice }} <CopyButton :content="voice" /></td>
                    </tr>
                    </tbody>
                  </v-table>
                </v-expansion-panel-text>
              </v-expansion-panel>
            </v-expansion-panels>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-card>
</template>

<script lang="ts">
import { mapState } from "pinia";
import { useAppStore } from "@/stores/app";
import eventBus from "@/eventBus";

export default {
  data() {
    return {
      backendConfigText: "" as string,
      voiceFilter: "" as string,

      // caret + selection tracking
      cursorPos: 0 as number,
      selection: { start: 0, end: 0 } as { start: number; end: number },

      // (optional) keep reference so we can unregister on unmount
      onConfigWriteHandler: null as null | ((data: string) => void),
      onWsConnectedHandler: null as null | (() => void),
    };
  },

  mounted() {
    this.backendConfigText = this.getBackendConfig;

    // ALWAYS register config:write (not only when empty)
    this.onConfigWriteHandler = (data: string) => {
      this.insertAtCursor(data);
    };
    eventBus.$on("config:write", this.onConfigWriteHandler);

    // If config isn't loaded yet, update after websocket connects
    if (this.backendConfigText === "") {
      this.onWsConnectedHandler = () => {
        setTimeout(() => {
          this.backendConfigText = this.getBackendConfig;
          this.$nextTick(() => this.updateCursor());
        }, 250);
      };
      eventBus.$on("websocket:connected", this.onWsConnectedHandler);
    }

    // initialize caret once it's rendered
    this.$nextTick(() => this.updateCursor());
  },

  beforeUnmount() {
    // clean up event listeners to avoid duplicates/memory leaks
    if (this.onConfigWriteHandler) eventBus.$off("config:write", this.onConfigWriteHandler);
    if (this.onWsConnectedHandler) eventBus.$off("websocket:connected", this.onWsConnectedHandler);
  },

  computed: {
    ...mapState(useAppStore, [
      "getBackendConfig",
      "getParsedBackendConfig",
      "getObsSceneData",
      "getVoices",
      "getTestMode",
    ]),
  },

  methods: {
    copyToClipboard(text: string) {
      eventBus.$emit('config:write', text)
    },

    saveConfig() {
      eventBus.$emit("websocket:send", {
        method: "update_config",
        params: { data: this.backendConfigText },
      });
    },

    toggleTestMode() {
      eventBus.$emit("websocket:send", {
        method: "toggle_test_mode",
        params: { active: !this.getTestMode },
      });
    },

    // --- caret helpers ---
    getNativeTextarea(): HTMLTextAreaElement | null {
      const comp = this.$refs.configTextarea as any;
      if (!comp?.$el) return null;
      return comp.$el.querySelector("textarea");
    },

    updateCursor() {
      const el = this.getNativeTextarea();
      if (!el) return;

      const start = el.selectionStart ?? 0;
      const end = el.selectionEnd ?? start;

      this.cursorPos = start;
      this.selection = { start, end };
    },

    insertAtCursor(text: string) {
      // Make sure selection state is fresh
      this.updateCursor();

      const start = this.selection.start ?? this.cursorPos ?? 0;
      const end = this.selection.end ?? start;

      const current = this.backendConfigText ?? "";
      this.backendConfigText = current.slice(0, start) + text + current.slice(end);

      const newPos = start + text.length;

      // After DOM updates, restore caret
      this.$nextTick(() => {
        const el = this.getNativeTextarea();
        if (el) {
          el.focus();
          el.setSelectionRange(newPos, newPos);
        }

        this.cursorPos = newPos;
        this.selection = { start: newPos, end: newPos };
      });
    },
  },
};
</script>

<style lang="scss">
</style>
