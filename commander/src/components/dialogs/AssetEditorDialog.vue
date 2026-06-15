<script lang="ts">
type WledControl = {
  name: string;
  red: number | null;
  green: number | null;
  blue: number | null;
  white: number | null;
  effect: number | null;
};

type MediaEntry = {
  name: string;
  path: string;
  type: "file" | "folder";
  asset?: string | { original?: string; compressed?: string | null } | null;
  compressed?: string | null;
};

const emptyForm = () => ({
  name: "",
  sound: "",
  icon: "",
  message: "",
  duration: null as number | null,
  color: "",
  channel: "",
  volume: null as number | null,
  image: "",
  video: "",
  start_macros: [] as string[],
  idle_macros: [] as string[],
  end_macros: [] as string[],
  wled: [] as WledControl[],
});

const mdiSuggestions = [
  "alert",
  "bell",
  "bell-ring",
  "bullhorn",
  "cash",
  "cash-multiple",
  "charity",
  "chat",
  "chat-alert",
  "crown",
  "emoticon",
  "emoticon-cool",
  "fire",
  "gift",
  "heart",
  "heart-pulse",
  "information",
  "lightning-bolt",
  "party-popper",
  "pistol",
  "rocket",
  "star",
  "star-four-points",
  "trophy",
  "video",
  "volume-high",
  "led-strip-variant",
  "test-tube",
  "account",
  "account-heart",
  "gamepad-variant",
  "sword",
  "shield",
  "skull",
  "ghost",
  "timer",
  "clock",
  "camera",
  "microphone",
  "dice-6",
  "controller-classic",
  "youtube",
  "twitch",
  "discord",
].sort();

export default {
  name: "AssetEditorDialog",

  props: {
    modelValue: { type: Boolean, default: false },
    assetName: { type: String, default: "" },
    asset: { type: Object, default: null },
    loading: { type: Boolean, default: false },
    error: { type: String, default: "" },
    macroItems: { type: Array, default: () => [] },
    mediaEntries: { type: Array, default: () => [] },
    wledItems: { type: Array, default: () => [] },
  },

  emits: ["update:modelValue", "save"],

  data() {
    return {
      form: emptyForm(),
      colorMenu: false,
      mdiSuggestions,
    };
  },

  computed: {
    title(): string {
      return this.assetName
        ? `${this.$t("assets.editor") || "Asset editor"}: ${this.assetName}`
        : this.$t("assets.createFile") || "Add asset";
    },

    canSave(): boolean {
      return this.form.name.trim().length > 0 && !this.loading;
    },

    normalizedColor: {
      get(): string {
        const value = String(this.form.color ?? "").trim();
        if (!value) return "#66BB6A";
        return value.startsWith("#") ? value : `#${value}`;
      },
      set(value: string) {
        this.form.color = String(value ?? "")
          .replace(/^#/, "")
          .toUpperCase();
      },
    },

    macroOptions(): string[] {
      return (this.macroItems as any[])
        .map((item: any) => (typeof item === "string" ? item : item?.name))
        .filter(Boolean)
        .map(String)
        .sort((a: string, b: string) => a.localeCompare(b));
    },

    wledOptions(): string[] {
      return (this.wledItems as any[])
        .map((item: any) => (typeof item === "string" ? item : item?.name))
        .filter(Boolean)
        .map(String)
        .sort((a: string, b: string) => a.localeCompare(b));
    },

    iconOptions(): string[] {
      const current = this.normalizeIconName(this.form.icon);
      const options = [...this.mdiSuggestions];
      if (current && !options.includes(current)) options.unshift(current);
      return options;
    },

    soundOptions(): string[] {
      return this.mediaOptions(/\.(mp3|opus)$/i, false);
    },

    imageOptions(): string[] {
      return this.mediaOptions(/\.(webp|jpe?g|png|gif|svg)$/i, true);
    },

    videoOptions(): string[] {
      return this.mediaOptions(/\.(webm|mp4|mov|mkv)$/i, true);
    },
  },

  watch: {
    modelValue(value: boolean) {
      if (value) this.resetForm();
    },
    asset: {
      deep: true,
      handler() {
        if (this.modelValue) this.resetForm();
      },
    },
    assetName() {
      if (this.modelValue) this.resetForm();
    },
  },

  methods: {
    resetForm() {
      const asset: any = this.asset ?? {};
      const form = emptyForm();

      form.name = String(this.assetName || asset?.name || "").trim();
      form.sound = String(asset?.sound ?? "");
      form.icon = this.normalizeIconName(asset?.icon ?? "");
      form.message = String(asset?.message ?? "");
      form.duration = this.toNullableNumber(asset?.duration);
      form.color = String(asset?.color ?? "")
        .replace(/^#/, "")
        .toUpperCase();
      form.channel = String(asset?.channel ?? "");
      form.volume = this.toNullableNumber(asset?.volume);
      form.image = String(asset?.image ?? "");
      form.video = String(asset?.video ?? "");
      form.start_macros = this.toStringArray(asset?.start_macros);
      form.idle_macros = this.toStringArray(asset?.idle_macros);
      form.end_macros = this.toStringArray(asset?.end_macros);
      form.wled = this.toWledControls(asset?.wled);

      this.form = form;
    },

    normalizeIconName(value: any): string {
      const rawValue =
        typeof value === "object" && value !== null
          ? (value.raw ?? value.title ?? value.value ?? "")
          : value;

      return String(rawValue ?? "")
        .trim()
        .replace(/^mdi:/, "")
        .replace(/^mdi-/, "");
    },

    iconValue(value: string): string {
      const normalized = this.normalizeIconName(value);
      return normalized ? `mdi-${normalized}` : "mdi-palette";
    },

    getEntryOriginal(entry: MediaEntry): string {
      if (typeof entry.asset === "object" && entry.asset?.original)
        return this.normalizePath(entry.asset.original);
      if (typeof entry.asset === "string")
        return this.normalizePath(entry.asset);
      return this.normalizePath(entry.path);
    },

    getEntryCompressed(entry: MediaEntry): string {
      if (typeof entry.compressed === "string")
        return this.normalizePath(entry.compressed);
      if (
        typeof entry.asset === "object" &&
        typeof entry.asset?.compressed === "string"
      )
        return this.normalizePath(entry.asset.compressed);
      return "";
    },

    mediaOptions(regex: RegExp, compressedFirst: boolean): string[] {
      const values: string[] = [];
      const add = (value: string) => {
        const normalized = this.normalizePath(value);
        if (!normalized || !regex.test(normalized)) return;
        regex.lastIndex = 0;
        if (!values.includes(normalized)) values.push(normalized);
      };

      for (const entry of this.mediaEntries as MediaEntry[]) {
        if (!entry || entry.type !== "file") continue;
        const original = this.getEntryOriginal(entry);
        const compressed = this.getEntryCompressed(entry);

        if (compressedFirst) {
          add(compressed);
          add(original);
        } else {
          add(original);
          add(compressed);
        }
      }

      return values;
    },

    normalizePath(value: any): string {
      return String(value ?? "")
        .replace(/\\/g, "/")
        .replace(/^\/+/, "")
        .trim();
    },

    toNullableNumber(value: any): number | null {
      if (value === undefined || value === null || value === "") return null;
      const numberValue = Number(value);
      return Number.isFinite(numberValue) ? numberValue : null;
    },

    toStringArray(value: any): string[] {
      if (!value) return [];
      if (Array.isArray(value))
        return value.map((item) => String(item)).filter(Boolean);
      return String(value)
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    },

    toWledControls(value: any): WledControl[] {
      if (!value || typeof value !== "object") return [];

      return Object.entries(value).map(([name, control]: [string, any]) => ({
        name,
        red: this.toNullableNumber(control?.red),
        green: this.toNullableNumber(control?.green),
        blue: this.toNullableNumber(control?.blue),
        white: this.toNullableNumber(control?.white),
        effect: this.toNullableNumber(control?.effect),
      }));
    },

    addWledControl() {
      this.form.wled.push({
        name: "",
        red: null,
        green: null,
        blue: null,
        white: null,
        effect: null,
      });
    },

    removeWledControl(index: number) {
      this.form.wled.splice(index, 1);
    },

    cleanString(value: any): string | undefined {
      const normalized = String(value ?? "").trim();
      return normalized ? normalized : undefined;
    },

    cleanNumber(value: any): number | undefined {
      if (value === undefined || value === null || value === "")
        return undefined;
      const numberValue = Number(value);
      return Number.isFinite(numberValue) ? numberValue : undefined;
    },

    cleanByte(value: any): number | undefined {
      const numberValue = this.cleanNumber(value);
      if (numberValue === undefined) return undefined;
      return Math.min(255, Math.max(0, Math.round(numberValue)));
    },

    buildAssetPayload() {
      const asset: Record<string, any> = {};

      for (const key of [
        "sound",
        "icon",
        "message",
        "color",
        "channel",
        "image",
        "video",
      ]) {
        let value = this.cleanString((this.form as any)[key]);
        if (key === "icon" && value) value = this.normalizeIconName(value);
        if (key === "color" && value)
          value = value.replace(/^#/, "").toUpperCase();
        if (value !== undefined) asset[key] = value;
      }

      const duration = this.cleanNumber(this.form.duration);
      if (duration !== undefined) asset.duration = duration;

      const volume = this.cleanNumber(this.form.volume);
      if (volume !== undefined) asset.volume = volume;

      for (const key of ["start_macros", "idle_macros", "end_macros"]) {
        const values = this.toStringArray((this.form as any)[key]);
        if (values.length) asset[key] = values;
      }

      const wled: Record<string, any> = {};
      for (const control of this.form.wled) {
        const name = this.cleanString(control.name);
        if (!name) continue;

        const data: Record<string, any> = {};
        for (const key of ["red", "green", "blue", "white", "effect"]) {
          const value = this.cleanByte((control as any)[key]);
          if (value !== undefined) data[key] = value;
        }

        if (Object.keys(data).length) wled[name] = data;
      }

      if (Object.keys(wled).length) asset.wled = wled;

      return asset;
    },

    submit() {
      if (!this.canSave) return;
      const name = this.form.name.trim();

      this.$emit("save", {
        name,
        path: `${
          name
            .replace(/[\\/]+/g, "_")
            .replace(/[^a-zA-Z0-9_.-]+/g, "_")
            .replace(/^\.+/, "") || "asset"
        }.yaml`,
        asset: this.buildAssetPayload(),
      });
    },
  },
};
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    max-width="1100"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <v-card color="grey-darken-4">
      <v-toolbar flat density="compact">
        <v-toolbar-title class="d-flex align-center">{{
            title
          }}</v-toolbar-title>
        <v-btn
          icon="mdi-close"
          variant="text"
          @click="$emit('update:modelValue', false)"
        />
      </v-toolbar>

      <v-card-text>
        <v-alert
          v-if="error"
          type="error"
          color="red-darken-3"
          class="mb-3"
          :text="error"
        />

        <v-form @submit.prevent="submit">
          <v-row density="comfortable">
            <v-col cols="12" md="6">
              <v-text-field
                v-model="form.name"
                :label="$t('assets.name')"
                prepend-inner-icon="mdi-palette"
                variant="outlined"
                :disabled="Boolean(assetName) || loading"
                hide-details="auto"
              />
            </v-col>

            <v-col cols="12" md="6">
              <v-combobox
                v-model="form.channel"
                :label="$t('assets.channel')"
                prepend-inner-icon="mdi-broadcast"
                variant="outlined"
                :disabled="loading"
                hide-details="auto"
              />
            </v-col>

            <v-col cols="12">
              <v-text-field
                v-model="form.message"
                :label="$t('assets.message')"
                prepend-inner-icon="mdi-message-text"
                variant="outlined"
                :disabled="loading"
                hide-details="auto"
              />
            </v-col>

            <v-col cols="12" md="6">
              <v-autocomplete
                v-model="form.sound"
                :items="soundOptions"
                :label="$t('assets.sound')"
                prepend-inner-icon="mdi-volume-high"
                variant="outlined"
                clearable
                :disabled="loading"
                hide-details="auto"
              />
            </v-col>

            <v-col cols="12" md="6">
              <v-combobox
                v-model="form.icon"
                :items="iconOptions"
                :label="$t('assets.icon') || 'Icon'"
                prepend-inner-icon="mdi-emoticon"
                variant="outlined"
                clearable
                :disabled="loading"
                hide-details="auto"
                @update:model-value="form.icon = normalizeIconName($event)"
              >
                <template #item="{ props, item }">
                  <v-list-item v-bind="props">
                    <template #prepend>
                      <v-icon
                        :icon="
                          iconValue(item?.raw ?? item?.title ?? item?.value)
                        "
                      />
                    </template>
                    <v-list-item-title>{{
                        normalizeIconName(item?.raw ?? item?.title ?? item?.value)
                      }}</v-list-item-title>
                  </v-list-item>
                </template>
                <template #chip="{ item, props }">
                  <v-chip v-bind="props" :prepend-icon="iconValue(form.icon)" />
                </template>
              </v-combobox>
            </v-col>

            <v-col cols="12" md="4">
              <v-menu v-model="colorMenu" :close-on-content-click="false">
                <template #activator="{ props }">
                  <v-text-field
                    v-bind="props"
                    v-model="form.color"
                    :label="$t('assets.color')"
                    prepend-inner-icon="mdi-palette"
                    variant="outlined"
                    :disabled="loading"
                    hide-details="auto"
                  >
                    <template #append-inner>
                      <div
                        class="asset-color-preview"
                        :style="{ backgroundColor: normalizedColor }"
                      />
                    </template>
                  </v-text-field>
                </template>
                <v-card color="grey-darken-3">
                  <v-color-picker
                    v-model="normalizedColor"
                    mode="hex"
                    hide-inputs
                  />
                </v-card>
              </v-menu>
            </v-col>

            <v-col cols="12" md="4">
              <v-number-input
                v-model="form.duration"
                :label="$t('assets.duration')"
                prepend-inner-icon="mdi-timer"
                variant="outlined"
                :disabled="loading"
                hide-details="auto"
                :step="0.1"
              />
            </v-col>

            <v-col cols="12" md="4">
              <v-number-input
                v-model="form.volume"
                :label="$t('assets.volume')"
                prepend-inner-icon="mdi-volume-medium"
                variant="outlined"
                :disabled="loading"
                hide-details="auto"
                :step="0.1"
                :max="1"
              />
            </v-col>

            <v-col cols="12" md="4">
              <v-autocomplete
                v-model="form.image"
                :items="imageOptions"
                :label="$t('assets.image')"
                prepend-inner-icon="mdi-image"
                variant="outlined"
                clearable
                :disabled="loading"
                hide-details="auto"
              />
            </v-col>

            <v-col cols="12" md="4">
              <v-autocomplete
                v-model="form.video"
                :items="videoOptions"
                :label="$t('assets.video')"
                prepend-inner-icon="mdi-video"
                variant="outlined"
                clearable
                :disabled="loading"
                hide-details="auto"
              />
            </v-col>

            <v-col cols="12" md="4">
              <v-combobox
                v-model="form.start_macros"
                :items="macroOptions"
                :label="$t('assets.startMacros')"
                multiple
                chips
                closable-chips
                variant="outlined"
                :disabled="loading"
                hide-details="auto"
              />
            </v-col>
            <v-col cols="12" md="4">
              <v-combobox
                v-model="form.idle_macros"
                :items="macroOptions"
                :label="$t('assets.idleMacros')"
                multiple
                chips
                closable-chips
                variant="outlined"
                :disabled="loading"
                hide-details="auto"
              />
            </v-col>
            <v-col cols="12" md="4">
              <v-combobox
                v-model="form.end_macros"
                :items="macroOptions"
                :label="$t('assets.endMacros')"
                multiple
                chips
                closable-chips
                variant="outlined"
                :disabled="loading"
                hide-details="auto"
              />
            </v-col>
          </v-row>

          <v-divider class="my-4" />

          <div class="d-flex align-center justify-space-between mb-3">
            <div class="text-subtitle-2">{{ $t("assets.wled") || "WLED" }}</div>
            <v-btn
              size="small"
              variant="tonal"
              prepend-icon="mdi-plus"
              :disabled="loading"
              @click="addWledControl"
            >
              {{ $t("assets.addWled") || "Add WLED control" }}
            </v-btn>
          </div>

          <v-card
            v-for="(control, index) in form.wled"
            :key="index"
            color="grey-darken-3"
            variant="flat"
            class="mb-3"
          >
            <v-card-text>
              <div class="d-flex align-center ga-2 mb-3">
                <v-combobox
                  v-model="control.name"
                  :items="wledOptions"
                  :label="$t('assets.wledName') || 'WLED name'"
                  variant="outlined"
                  density="compact"
                  :disabled="loading"
                  hide-details="auto"
                />
                <v-btn
                  icon="mdi-delete"
                  color="red"
                  variant="text"
                  :disabled="loading"
                  @click="removeWledControl(index)"
                />
              </div>

              <v-row density="compact">
                <v-col cols="6" md="2"
                ><v-number-input
                  v-model="control.red"
                  :label="$t('assets.red') || 'Red'"
                  variant="outlined"
                  density="compact"
                  :disabled="loading"
                  hide-details="auto"
                /></v-col>
                <v-col cols="6" md="2"
                ><v-number-input
                  v-model="control.green"
                  :label="$t('assets.green') || 'Green'"
                  variant="outlined"
                  density="compact"
                  :disabled="loading"
                  hide-details="auto"
                /></v-col>
                <v-col cols="6" md="2"
                ><v-number-input
                  v-model="control.blue"
                  :label="$t('assets.blue') || 'Blue'"
                  variant="outlined"
                  density="compact"
                  :disabled="loading"
                  hide-details="auto"
                /></v-col>
                <v-col cols="6" md="2"
                ><v-number-input
                  v-model="control.white"
                  :label="$t('assets.white') || 'White'"
                  variant="outlined"
                  density="compact"
                  :disabled="loading"
                  hide-details="auto"
                /></v-col>
                <v-col cols="6" md="2"
                ><v-number-input
                  v-model="control.effect"
                  :label="$t('assets.effect') || 'Effect'"
                  variant="outlined"
                  density="compact"
                  :disabled="loading"
                  hide-details="auto"
                /></v-col>
              </v-row>
            </v-card-text>
          </v-card>
        </v-form>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn
          variant="text"
          :disabled="loading"
          @click="$emit('update:modelValue', false)"
        >{{ $t("common.cancel") || "Cancel" }}</v-btn
        >
        <v-btn
          color="primary"
          variant="flat"
          :loading="loading"
          :disabled="!canSave"
          @click="submit"
        >{{ $t("common.save") || "Save" }}</v-btn
        >
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped lang="scss">
.asset-color-preview {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  border: thin solid rgba(var(--v-border-color), var(--v-border-opacity));
}
.min-width-0 {
  min-width: 0;
}
</style>
