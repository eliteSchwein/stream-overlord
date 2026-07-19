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

    subtitle(): string {
      return [
        this.channelPoint?.asset,
        this.channelPoint?.macro,
      ].filter(Boolean).join(' · ')
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
  <v-expansion-panel class="channel-point-panel">
    <template #title>
      <div class="channel-point-panel__title">
        <v-avatar size="40" :color="color" rounded="lg" class="pa-1">
          <v-img v-if="channelPoint.image" :src="channelPoint.image" cover />
          <v-icon v-else icon="mdi-star-circle" size="20" />
        </v-avatar>

        <div class="min-width-0">
          <div class="text-truncate" :title="title">{{ title }}</div>
        </div>

        <v-spacer />

        <v-switch
          v-if="channelPoint.id"
          :model-value="isActive"
          :loading="toggling"
          :disabled="disabled"
          density="compact"
          hide-details
          inset
          class="channel-point-panel__toggle"
          @click.stop
          color="primary"
          @update:model-value="$emit('toggle', channelPoint)"
        />
      </div>
    </template>

    <v-expansion-panel-text class="pa-0">
      <div class="channel-point-panel__content px-4 pt-3 pb-3">
        <div class="min-width-0">
        </div>

        <div class="channel-point-panel__actions">
          <v-btn
            prepend-icon="mdi-pencil"
            size="small"
            variant="tonal"
            color="primary"
            :disabled="disabled"
            @click="$emit('edit', channelPoint)"
          >
            {{ $t('common.edit') }}
          </v-btn>

          <v-btn
            prepend-icon="mdi-delete"
            size="small"
            variant="tonal"
            color="red"
            :loading="deleting"
            :disabled="disabled"
            @click="$emit('delete', channelPoint)"
          >
            {{ $t('common.delete') }}
          </v-btn>
        </div>
      </div>

      <v-table density="compact" class="channel-point-panel__table">
        <tbody>
        <tr>
          <td class="channel-point-panel__field-label">Name</td>
          <td>{{ channelPoint.name }}</td>
        </tr>
        <tr>
          <td class="channel-point-panel__field-label">Label</td>
          <td>{{ channelPoint.label }}</td>
        </tr>
        <tr>
          <td class="channel-point-panel__field-label">Asset</td>
          <td>{{ channelPoint.asset }}</td>
        </tr>
        <tr>
          <td class="channel-point-panel__field-label">Macro</td>
          <td>{{ channelPoint.macro }}</td>
        </tr>
        <tr>
          <td class="channel-point-panel__field-label">Enable default</td>
          <td>{{ channelPoint.enable_default === true ? 'yes' : 'no' }}</td>
        </tr>
        <tr>
          <td class="channel-point-panel__field-label">Auto accept</td>
          <td>{{ channelPoint.auto_accept === true ? 'yes' : 'no' }}</td>
        </tr>
        <tr>
          <td class="channel-point-panel__field-label">Strip emotes</td>
          <td>{{ channelPoint.strip_emotes === true ? 'yes' : 'no' }}</td>
        </tr>
        </tbody>
      </v-table>
    </v-expansion-panel-text>
  </v-expansion-panel>
</template>

<style scoped lang="scss">
.channel-point-panel {
  &__title,
  &__content,
  &__actions {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }

  &__title {
    flex: 1 1 auto;
    width: 100%;
  }

  &__toggle {
    margin-left: auto;
    margin-right: 12px;
  }

  &__content {
    justify-content: space-between;
  }

  &__actions {
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  &__field-label {
    width: 180px;
    color: rgba(var(--v-theme-on-surface), .65);
    white-space: nowrap;
  }
}
</style>
