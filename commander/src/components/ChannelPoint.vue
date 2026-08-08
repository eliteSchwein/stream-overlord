<script lang="ts">
export default {
  name: 'ChannelPoint',

  props: {
    channelPoint: {
      type: Object,
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
    toggling: {
      type: Boolean,
      default: false,
    },
  },

  emits: ['edit', 'delete', 'toggle'],

  computed: {
    title(): string {
      return String(this.channelPoint?.label ?? this.channelPoint?.name ?? '')
    },

    isActive(): boolean {
      return this.channelPoint?.active !== false
    },

    color(): string {
      if (!this.isActive) return 'grey-darken-3'
      return this.channelPoint?.background || 'grey-darken-4'
    },
  },
}
</script>

<template>
  <div class="channel-point-row">
    <div class="channel-point-row__content">
      <v-avatar
        size="40"
        :color="color"
        rounded="lg"
        class="channel-point-row__avatar pa-1"
      >
        <v-img
          v-if="channelPoint.image"
          :src="channelPoint.image"
          cover
        />
        <v-icon
          v-else
          icon="mdi-star-circle"
          size="20"
        />
      </v-avatar>

      <div class="channel-point-row__text min-width-0">
        <div
          class="channel-point-row__name text-truncate"
          :title="title"
        >
          {{ title }}
        </div>

        <div
          v-if="channelPoint.name && channelPoint.name !== title"
          class="channel-point-row__internal-name text-caption text-medium-emphasis text-truncate"
          :title="channelPoint.name"
        >
          {{ channelPoint.name }}
        </div>
      </div>
    </div>

    <div class="channel-point-row__actions">
      <v-switch
        v-if="channelPoint.id"
        :model-value="isActive"
        :loading="toggling"
        :disabled="disabled"
        density="compact"
        hide-details
        inset
        color="primary"
        class="channel-point-row__toggle"
        @update:model-value="$emit('toggle', channelPoint)"
      />

      <v-btn
        size="small"
        variant="tonal"
        color="primary"
        :disabled="disabled"
        @click="$emit('edit', channelPoint)"
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
        @click="$emit('delete', channelPoint)"
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
.channel-point-row {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 56px;
  padding: 8px 14px;
  background: rgb(var(--v-theme-grey-darken-4));
  border-bottom: thin solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.channel-point-row__content {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex: 1 1 auto;
}

.channel-point-row__avatar {
  flex: 0 0 auto;
}

.channel-point-row__text {
  flex: 1 1 auto;
}

.channel-point-row__name {
  font-weight: 500;
}

.channel-point-row__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
}

.channel-point-row__toggle {
  flex: 0 0 auto;
  margin-right: 2px;
}

.min-width-0 {
  min-width: 0;
}

@media (max-width: 600px) {
  .channel-point-row {
    padding-inline: 10px;
  }

  .channel-point-row__internal-name {
    display: none;
  }

  .channel-point-row__actions {
    gap: 4px;
  }

  .channel-point-row__actions .v-btn {
    min-width: 36px;
    padding-inline: 8px;
  }
}
</style>
