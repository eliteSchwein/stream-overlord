<template>
  <MacroTaskAccordionTemplate
    :item="item"
    :index="index"
    icon="mdi-account-clock"
    :title="$t('macro.twitch.timeout.title')"
    export-prefix="macro_twitch_timeout"
    @remove="$emit('remove')"
    @move-up="$emit('move-up')"
    @move-down="$emit('move-down')"
  >
    <v-row>
      <v-col cols="12" md="6">
        <v-text-field
          v-model="task.data.user"
          variant="outlined"
          :label="$t('macro.twitch.fields.user')"
          :placeholder="$t('macro.twitch.placeholders.usernameOrVariable')"
        />
      </v-col>

      <v-col cols="12" md="6">
        <v-text-field
          v-model.number="task.data.duration"
          variant="outlined"
          type="number"
          min="1"
          max="1209600"
          :label="$t('macro.twitch.timeout.durationSeconds')"
          :hint="$t('macro.twitch.timeout.maximumHint')"
          persistent-hint
        />
      </v-col>

      <v-col cols="12">
        <v-text-field
          v-model="task.data.reason"
          variant="outlined"
          :label="$t('macro.twitch.fields.reason')"
          :placeholder="$t('macro.twitch.placeholders.optionalReasonOrVariable')"
        />
      </v-col>
    </v-row>
  </MacroTaskAccordionTemplate>
</template>

<script lang="ts">
import MacroTaskAccordionTemplate from '../MacroTaskAccordionTemplate.vue'

export default {
  name: 'MacroTwitchTimeoutTaskAccordion',
  components: { MacroTaskAccordionTemplate },
  props: {
    item: { type: Object, required: true },
    index: { type: Number, required: true },
  },
  emits: ['remove', 'move-up', 'move-down'],
  computed: {
    task(): any { return (this.item as any).task },
  },
  created() {
    this.task.channel = 'twitch'
    this.task.method = 'timeout'
    this.task.data = this.task.data && typeof this.task.data === 'object' ? this.task.data : {}
    this.task.data.user ??= ''
    this.task.data.duration ??= 600
    this.task.data.reason ??= ''
  },
}
</script>
