<script lang="ts">
import {useAppStore} from '@/stores/app'
import YamlImportExportButtons from '@/components/YamlImportExportButtons.vue'
import MacroWledControlEditor from '@/components/MacroWledControlEditor.vue'

type WledControl = {
  name: string;
  red: number | null;
  green: number | null;
  blue: number | null;
  white: number | null;
  effect: number | null;
  brightness: number | null;
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

  components: {
    YamlImportExportButtons,
    MacroWledControlEditor,
  },

  props: {
    modelValue: {type: Boolean, default: false},
    assetName: {type: String, default: ""},
    asset: {type: Object, default: null},
    loading: {type: Boolean, default: false},
    error: {type: String, default: ""},
    macroItems: {type: Array, default: () => []},
    mediaEntries: {type: Array, default: () => []},
    wledItems: {type: Array, default: () => []},
  },

  emits: ["update:modelValue", "save"],

  data() {
    return {
      form: emptyForm(),
      colorMenu: false,
      wledColorMenus: [] as boolean[],
      mdiSuggestions,
      wledEffectsByLamp: {} as Record<string, Array<{ title: string; value: number }>>,
      pendingWledControlIndex: null as number | null,
      importError: "",
    };
  },

  computed: {
    title(): string {
      return this.assetName
        ? `${this.$t("assets.editor")}: ${this.assetName}`
        : this.$t("assets.createFile");
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
      return this.getWledConfigEntries()
        .map((item: any) => item.name)
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
      return this.mediaOptions(/\.(mp3|flac|wav|ogg|m4a|opus)$/i, false);
    },

    imageOptions(): string[] {
      return this.mediaOptions(/\.(webp|jpe?g|png|gif|svg)$/i, true);
    },

    videoOptions(): string[] {
      return this.mediaOptions(/\.(webm|mp4|mov|mkv)$/i, true);
    },
  },

  methods: {
    async open() {
      this.resetForm();
      await this.initializeWledData("open");
    },

    async initializeWledData(reason = "unknown") {
      const appStore = useAppStore();


      try {
        await appStore.fetchConfig();
      } catch (error) {
      }

      const entries = this.getWledConfigEntries();

      await this.loadWledEffectsForAllLamps(`initialize: ${reason}`);
    },

    stripWledPrefix(value: any): string {
      const stripped = String(value ?? "")
        .trim()
        .replace(/^wled[\s_-]*/i, "")
        .replace(/^wled(?=[A-Z0-9])/i, "")
        .trim();

      return stripped || String(value ?? "").trim();
    },

    getWledConfigEntries(): Array<Record<string, any>> {
      const integrations = this.appStore?.getIntegrations ?? useAppStore().getIntegrations ?? {}
      const wled = integrations?.wled ?? {}

      return Object.entries(wled).map(([name, value]: [string, any]) => ({
        name: this.stripWledPrefix(name),
        ip: value?.ip ?? value,
      }))
    },

    getWledBaseUrl(lamp: any): string {
      const ip = String(lamp?.ip ?? '').trim()
      if (!ip) return ''

      return (/^https?:\/\//i.test(ip) ? ip : `http://${ip}`).replace(/\/+$/, '')
    },

    getWledLampEntry(name: any): Record<string, any> | undefined {
      const normalizedName = this.stripWledPrefix(name).toLowerCase();
      return this.getWledConfigEntries().find(
        (entry: any) => String(entry.name).toLowerCase() === normalizedName,
      );
    },

    getWledEffectCacheKey(name: any): string {
      return this.stripWledPrefix(name).toLowerCase();
    },

    wledEffectOptions(name: any): Array<{ title: string; value: number }> {
      const key = this.getWledEffectCacheKey(name);
      return key ? this.wledEffectsByLamp[key] ?? [] : [];
    },

    async loadWledEffectsForAllLamps(reason = "unknown") {
      const entries = this.getWledConfigEntries();

      await Promise.all(entries.map((entry: any) => this.loadWledEffects(entry.name, reason)));
    },

    async loadWledEffects(name: any, reason = "unknown") {
      const lamp = this.getWledLampEntry(name);
      const baseUrl = this.getWledBaseUrl(lamp);
      const cacheKey = this.getWledEffectCacheKey(name);
      const url = baseUrl ? `${baseUrl}/json/eff` : "";


      if (!cacheKey || !url) {
        return;
      }

      try {
        const response = await fetch(url, { cache: "no-store" });

        const effects = await response.json();
        const mappedEffects = Array.isArray(effects)
          ? effects.map((effect: any, index: number) => ({
            title: `${index} - ${String(effect)}`,
            value: index,
          }))
          : [];

        this.wledEffectsByLamp = {
          ...this.wledEffectsByLamp,
          [cacheKey]: mappedEffects,
        };

      } catch (error) {
        this.wledEffectsByLamp = {
          ...this.wledEffectsByLamp,
          [cacheKey]: [],
        };
      }
    },

    setAsset(asset: any = {}) {
      const form = emptyForm();

      form.name = String(this.form.name || this.assetName || asset?.name || "").trim();
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
      this.wledColorMenus = form.wled.map(() => false);
    },

    importAssetYaml(payload: any) {
      const parsed = payload?.data ?? {};
      const asset = parsed?.content ?? parsed?.asset ?? parsed;

      if (!asset || typeof asset !== "object" || Array.isArray(asset)) {
        this.importError = "invalid asset yaml";
        return;
      }

      this.importError = "";
      this.setAsset(asset);
    },

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
      this.wledColorMenus = form.wled.map(() => false);
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
        name: this.stripWledPrefix(name),
        red: this.toNullableNumber(control?.red),
        green: this.toNullableNumber(control?.green),
        blue: this.toNullableNumber(control?.blue),
        white: this.toNullableNumber(control?.white),
        effect: this.toNullableNumber(control?.effect),
        brightness: this.toNullableNumber(control?.brightness),
      }));
    },

    openCreateWledDialog(index: number | null = null) {
      this.pendingWledControlIndex = index
      this.$refs.wledIntegrationDialog?.open(index !== null ? this.form.wled?.[index]?.name ?? '' : '')
    },

    handleWledCreated(name: string) {
      if (this.pendingWledControlIndex !== null && this.form.wled?.[this.pendingWledControlIndex]) {
        this.form.wled[this.pendingWledControlIndex].name = name
        void this.loadWledEffects(name)
      }

      this.pendingWledControlIndex = null
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
      this.wledColorMenus.push(false);
    },

    removeWledControl(index: number) {
      this.form.wled.splice(index, 1);
      this.wledColorMenus.splice(index, 1);
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

    byteToHex(value: any): string {
      const numberValue = this.cleanByte(value) ?? 0;
      return numberValue.toString(16).padStart(2, "0").toUpperCase();
    },

    getWledRgbHex(control: WledControl): string {
      return `#${this.byteToHex(control.red)}${this.byteToHex(control.green)}${this.byteToHex(control.blue)}`;
    },

    setWledRgbHex(control: WledControl, value: any) {
      const rawColor = value && typeof value === "object"
        ? (value.hex ?? value.hexa ?? value.hex8 ?? value.value ?? value.raw?.hex ?? "")
        : value;

      const hex = String(rawColor ?? "")
        .replace(/^#/, "")
        .trim();

      const normalizedHex = hex.length === 8 ? hex.slice(0, 6) : hex;

      if (!/^[0-9a-f]{6}$/i.test(normalizedHex)) return;

      control.red = parseInt(normalizedHex.slice(0, 2), 16);
      control.green = parseInt(normalizedHex.slice(2, 4), 16);
      control.blue = parseInt(normalizedHex.slice(4, 6), 16);
    },

    setWledEffect(control: WledControl, value: any) {
      const rawValue = value && typeof value === "object"
        ? (value.value ?? value.raw?.value ?? value.raw ?? value.title)
        : value;
      control.effect = this.toNullableNumber(rawValue);
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
        const normalizedName = this.stripWledPrefix(name);

        const data: Record<string, any> = {};
        for (const key of ["red", "green", "blue", "white", "brightness", "effect"]) {
          const value = this.cleanByte((control as any)[key]);
          if (value !== undefined) data[key] = value;
        }

        if (Object.keys(data).length) wled[normalizedName] = data;
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
      <v-toolbar density="compact" flat>
        <v-toolbar-title class="d-flex align-center">{{
            title
          }}
        </v-toolbar-title>

        <YamlImportExportButtons
          class="mr-2"
          :filename="`${form.name || assetName || 'asset'}.yaml`"
          :export-data="buildAssetPayload()"
          :disabled="loading"
          @import="importAssetYaml"
          @error="importError = $event?.message ?? 'import failed'"
        />
        <v-btn
          icon="mdi-close"
          variant="text"
          @click="$emit('update:modelValue', false)"
        />
      </v-toolbar>

      <v-card-text>
        <v-alert
          v-if="error || importError"
          type="error"
          color="red-darken-3"
          density="comfortable"
          class="mb-3"
          :text="importError || error"
        />

        <v-form @submit.prevent="submit">
          <v-row density="comfortable">
            <v-col cols="12" md="6">
              <v-text-field
                v-model="form.name"
                :disabled="Boolean(assetName) || loading"
                :label="$t('assets.name')"
                hide-details="auto"
                prepend-inner-icon="mdi-palette"
                variant="outlined"
              />
            </v-col>

            <v-col cols="12" md="6">
              <v-combobox
                v-model="form.channel"
                :disabled="loading"
                :label="$t('assets.channel')"
                hide-details="auto"
                prepend-inner-icon="mdi-broadcast"
                variant="outlined"
              />
            </v-col>

            <v-col cols="12">
              <v-text-field
                v-model="form.message"
                :disabled="loading"
                :label="$t('assets.message')"
                hide-details="auto"
                prepend-inner-icon="mdi-message-text"
                variant="outlined"
              />
            </v-col>

            <v-col cols="12" md="6">
              <v-autocomplete
                v-model="form.sound"
                :disabled="loading"
                :items="soundOptions"
                :label="$t('assets.sound')"
                clearable
                hide-details="auto"
                prepend-inner-icon="mdi-volume-high"
                variant="outlined"
              />
            </v-col>

            <v-col cols="12" md="6">
              <v-combobox
                v-model="form.icon"
                :disabled="loading"
                :items="iconOptions"
                :label="$t('assets.icon')"
                clearable
                hide-details="auto"
                prepend-inner-icon="mdi-emoticon"
                variant="outlined"
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
                      }}
                    </v-list-item-title>
                  </v-list-item>
                </template>
                <template #chip="{ item, props }">
                  <v-chip :prepend-icon="iconValue(form.icon)" v-bind="props"/>
                </template>
              </v-combobox>
            </v-col>

            <v-col cols="12" md="4">
              <v-menu v-model="colorMenu" :close-on-content-click="false">
                <template #activator="{ props }">
                  <v-text-field
                    v-model="form.color"
                    :disabled="loading"
                    :label="$t('assets.color')"
                    hide-details="auto"
                    prepend-inner-icon="mdi-palette"
                    v-bind="props"
                    variant="outlined"
                  >
                    <template #append-inner>
                      <div
                        :style="{ backgroundColor: normalizedColor }"
                        class="asset-color-preview"
                      />
                    </template>
                  </v-text-field>
                </template>
                <v-card color="grey-darken-3">
                  <v-color-picker
                    v-model="normalizedColor"
                    hide-inputs
                    mode="hex"
                  />
                </v-card>
              </v-menu>
            </v-col>

            <v-col cols="12" md="4">
              <v-number-input
                v-model="form.duration"
                :disabled="loading"
                :label="$t('assets.duration')"
                :step="0.1"
                hide-details="auto"
                prepend-inner-icon="mdi-timer"
                variant="outlined"
                :precision="2"
              />
            </v-col>

            <v-col cols="12" md="4">
              <v-number-input
                v-model="form.volume"
                :disabled="loading"
                :label="$t('assets.volume')"
                :max="1"
                :step="0.1"
                hide-details="auto"
                prepend-inner-icon="mdi-volume-medium"
                variant="outlined"
                :precision="2"
              />
            </v-col>

            <v-col cols="12" md="4">
              <v-autocomplete
                v-model="form.image"
                :disabled="loading"
                :items="imageOptions"
                :label="$t('assets.image')"
                clearable
                hide-details="auto"
                prepend-inner-icon="mdi-image"
                variant="outlined"
              />
            </v-col>

            <v-col cols="12" md="4">
              <v-autocomplete
                v-model="form.video"
                :disabled="loading"
                :items="videoOptions"
                :label="$t('assets.video')"
                clearable
                hide-details="auto"
                prepend-inner-icon="mdi-video"
                variant="outlined"
              />
            </v-col>

            <v-col cols="12" md="4">
              <v-combobox
                v-model="form.start_macros"
                :disabled="loading"
                :items="macroOptions"
                :label="$t('assets.startMacros')"
                chips
                closable-chips
                hide-details="auto"
                multiple
                variant="outlined"
              />
            </v-col>
            <v-col cols="12" md="4">
              <v-combobox
                v-model="form.idle_macros"
                :disabled="loading"
                :items="macroOptions"
                :label="$t('assets.idleMacros')"
                chips
                closable-chips
                hide-details="auto"
                multiple
                variant="outlined"
              />
            </v-col>
            <v-col cols="12" md="4">
              <v-combobox
                v-model="form.end_macros"
                :disabled="loading"
                :items="macroOptions"
                :label="$t('assets.endMacros')"
                chips
                closable-chips
                hide-details="auto"
                multiple
                variant="outlined"
              />
            </v-col>
          </v-row>

          <v-divider class="my-4"/>

          <div class="d-flex align-center justify-space-between mb-3">
            <div class="text-subtitle-2">{{ $t("assets.wled") }}</div>
            <v-btn
              :disabled="loading"
              prepend-icon="mdi-plus"
              size="small"
              variant="tonal"
              @click="addWledControl"
            >
              {{ $t("assets.addWled") }}
            </v-btn>
          </div>

          <MacroWledControlEditor
            v-for="(control, index) in form.wled"
            :key="index"
            v-model="form.wled[index]"
            class="mb-3"
            :disabled="loading"
            @remove="removeWledControl(index)"
          />
        </v-form>
      </v-card-text>

      <v-card-actions>
        <v-spacer/>
        <v-btn
          :disabled="loading"
          variant="text"
          @click="$emit('update:modelValue', false)"
        >{{ $t("common.cancel")}}
        </v-btn
        >
        <v-btn
          :disabled="!canSave"
          :loading="loading"
          color="primary"
          variant="flat"
          @click="submit"
        >{{ $t("common.save")}}
        </v-btn
        >
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style lang="scss" scoped>
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
