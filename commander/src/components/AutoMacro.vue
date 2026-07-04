<script setup lang="ts">
import { computed } from "vue";
import { getWebsocketClient } from "@/plugins/websocketInstance";

const props = withDefaults(defineProps<{
  autoMacro: any;
  mode?: "dashboard" | "editor";
}>(), {
  mode: "dashboard",
});

const emit = defineEmits<{
  edit: [autoMacro: any];
  delete: [autoMacro: any];
}>();

const isDashboardMode = computed(() => props.mode === "dashboard");
const isEditorMode = computed(() => props.mode === "editor");
const autoMacroName = computed(() => String(props.autoMacro?.name ?? ""));

const progressValue = computed(() => {
  const interval = Number(props.autoMacro?.interval ?? 0);
  const currentInterval = Number(props.autoMacro?.current_interval ?? 0);

  if (!interval || interval <= 0) return 0;
  return Math.max(0, Math.min(100, (100 / interval) * currentInterval));
});

const intervalLabel = computed(() => formatDuration(Number(props.autoMacro?.interval ?? 0)));

const macroList = computed(() => {
  const macros = props.autoMacro?.macros;
  return Array.isArray(macros) ? macros.map((macro: any) => String(macro)) : [];
});

const macrosLabel = computed(() => {
  if (macroList.value.length === 1) return "1 macro";
  return `${macroList.value.length} macros`;
});

const defaultEnabledLabel = computed(() => (
  props.autoMacro?.default_enabled === true ? "Starts enabled" : "Starts disabled"
));

function formatDuration(totalSeconds: number) {
  const seconds = Math.max(0, Math.round(Number(totalSeconds) || 0));
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours > 0) return `${hours}h ${remainingMinutes}m`;
  if (minutes > 0) return remainingSeconds ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  return `${seconds}s`;
}

function toggleAutoMacro(value: boolean | null) {
  const enabled = value === true;

  getWebsocketClient()?.send("toggle_auto_macro", {
    name: autoMacroName.value,
    enable: enabled,
    enabled,
  });
}
</script>

<template>
  <v-toolbar
    v-if="isDashboardMode"
    flat
    density="compact"
    rounded
    class="auto-macro-dashboard mb-2"
  >
    <v-toolbar-title class="d-flex align-center min-width-0" style="font-size: 1rem">
      <span class="text-truncate">{{ autoMacroName }}</span>
    </v-toolbar-title>

    <v-progress-linear
      :active="autoMacro?.enabled === true"
      :model-value="progressValue"
      location="bottom"
      absolute
      rounded
      color="grey-darken-1"
    />

    <template #append>
      <v-switch
        hide-details
        density="compact"
        class="mr-3"
        :model-value="autoMacro?.enabled === true"
        @update:model-value="toggleAutoMacro"
        @click.stop
      />
    </template>
  </v-toolbar>

  <v-card
    v-else
    color="grey-darken-4"
    variant="flat"
    class="auto-macro-editor mb-3"
  >
    <v-card-text class="pa-4">
      <div class="d-flex flex-column flex-md-row align-md-center ga-3">
        <div class="flex-grow-1 min-width-0">
          <div class="d-flex align-center ga-2 min-width-0 mb-2">
            <v-icon icon="mdi-timer-cog" size="small" />
            <div class="text-subtitle-1 text-truncate" :title="autoMacroName">
              {{ autoMacroName }}
            </div>
          </div>

          <div class="d-flex flex-wrap ga-2 mb-2">
            <v-chip size="small" variant="tonal" prepend-icon="mdi-clock-outline">
              Every {{ intervalLabel }}
            </v-chip>
            <v-chip size="small" variant="tonal" prepend-icon="mdi-code-braces">
              {{ macrosLabel }}
            </v-chip>
            <v-chip size="small" variant="tonal" prepend-icon="mdi-power">
              {{ defaultEnabledLabel }}
            </v-chip>
          </div>

          <div v-if="macroList.length" class="d-flex flex-wrap ga-1">
            <v-chip
              v-for="macro in macroList"
              :key="macro"
              size="x-small"
              variant="outlined"
            >
              {{ macro }}
            </v-chip>
          </div>

          <div v-else class="text-caption text-grey-lighten-1">
            No macros selected yet.
          </div>
        </div>

        <div class="d-flex flex-column flex-sm-row ga-2 flex-shrink-0">
          <v-btn
            color="primary"
            variant="tonal"
            prepend-icon="mdi-pencil"
            @click.stop="emit('edit', autoMacro)"
          >
            Edit auto macro
          </v-btn>

          <v-btn
            color="error"
            variant="tonal"
            prepend-icon="mdi-delete"
            @click.stop="emit('delete', autoMacro)"
          >
            Delete auto macro
          </v-btn>
        </div>
      </div>
    </v-card-text>
  </v-card>
</template>

<style scoped lang="scss">
.auto-macro-dashboard {
  min-height: 48px;
}

.auto-macro-editor {
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.min-width-0 {
  min-width: 0;
}
</style>
