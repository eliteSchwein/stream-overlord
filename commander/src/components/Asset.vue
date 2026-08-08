<script lang="ts">
export default {
  name: 'Asset',

  props: {
    asset: {
      type: Object,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    disabled: {
      type: Boolean,
      default: false,
    },
    deleting: {
      type: Boolean,
      default: false,
    },
  },

  emits: ['edit', 'delete'],

  methods: {
    getAssetIcon(asset: any) {
      const rawIcon = typeof asset?.icon === 'object' && asset?.icon !== null
        ? (asset.icon.raw ?? asset.icon.title ?? asset.icon.value ?? '')
        : asset?.icon

      const icon = String(rawIcon ?? '')
        .trim()
        .replace(/^mdi:/, '')
        .replace(/^mdi-/, '')

      if (!icon) return 'mdi-palette'
      return `mdi-${icon}`
    },

    getAssetColor(asset: any) {
      const color = String(asset?.color ?? '').trim().replace(/^#/, '')
      return /^[0-9a-f]{6}$/i.test(color) ? `#${color}` : 'primary'
    },
  },
}
</script>

<template>
  <div class="asset-row">
    <div class="asset-row__content">
      <v-avatar
        size="34"
        :color="getAssetColor(asset)"
        rounded="lg"
        class="asset-row__avatar"
      >
        <v-icon :icon="getAssetIcon(asset)" size="20" />
      </v-avatar>

      <div
        class="asset-row__name text-truncate"
        :title="name"
      >
        {{ name }}
      </div>
    </div>

    <div class="asset-row__actions">
      <v-btn
        size="small"
        variant="tonal"
        color="primary"
        :disabled="disabled"
        @click="$emit('edit', name, asset)"
      >
        <v-icon icon="mdi-pencil" />
        <span class="d-none d-sm-inline ml-1">
          {{ $t('common.edit') }}
        </span>
      </v-btn>

      <v-btn
        size="small"
        variant="tonal"
        color="red"
        :loading="deleting"
        :disabled="disabled"
        @click="$emit('delete', name, asset)"
      >
        <v-icon icon="mdi-delete" />
        <span class="d-none d-sm-inline ml-1">
          {{ $t('common.delete') }}
        </span>
      </v-btn>
    </div>
  </div>
</template>

<style scoped lang="scss">
.asset-row {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 56px;
  padding: 8px 14px;
  background: rgb(var(--v-theme-grey-darken-4));
  border-bottom: thin solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.asset-row__content {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex: 1 1 auto;
}

.asset-row__avatar {
  flex: 0 0 auto;
}

.asset-row__name {
  min-width: 0;
  font-weight: 500;
}

.asset-row__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
}

@media (max-width: 600px) {
  .asset-row {
    padding-inline: 10px;
  }

  .asset-row__actions {
    gap: 4px;
  }

  .asset-row__actions .v-btn {
    min-width: 36px;
    padding-inline: 8px;
  }
}
</style>
