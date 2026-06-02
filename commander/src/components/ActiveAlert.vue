<script setup lang="ts">

import {formatSeconds} from "@/helper/GeneralHelper.ts";
import eventBus from "@/eventBus.ts";

defineProps({
  alert: {}
})

function removeAlert(eventUuid: string) {
  eventBus.$emit('websocket:send', {
    method: 'remove_event',
    params: {'event-uuid': eventUuid}
  })
}

</script>

<template>
  <v-expansion-panel
    :color="alert.active ? 'green-darken-2' : 'grey-darken-3'"
    :title="$t('alerts.activeAlert.title', { uuid: alert['event-uuid'], duration: formatSeconds(alert.duration) })"
  >
    <v-expansion-panel-text class="pa-0">
      <v-table>
        <thead>
        <tr>
          <th class="text-left" style="width: 220px">
            {{ $t('alerts.activeAlert.name') }}
          </th>
          <th class="text-left">
            {{ $t('alerts.activeAlert.value') }}
          </th>
        </tr>
        </thead>
        <tbody>
        <tr>
          <td><v-icon icon="mdi-broadcast"></v-icon> {{ $t('alerts.activeAlert.channel') }}</td>
          <td>{{alert.channel}}</td>
        </tr>
        <tr v-if="alert.icon">
          <td><v-icon icon="mdi-circle-slice-1"></v-icon> {{ $t('alerts.activeAlert.icon') }}</td>
          <td>{{alert.icon}}</td>
        </tr>
        <tr v-if="alert.message">
          <td><v-icon icon="mdi-message"></v-icon> {{ $t('alerts.activeAlert.message') }}</td>
          <td>{{alert.message}}</td>
        </tr>
        <tr v-if="alert.sound">
          <td><v-icon icon="mdi-volume-low"></v-icon> {{ $t('alerts.activeAlert.sound') }}</td>
          <td>{{alert.sound}}</td>
        </tr>
        <tr v-if="alert.video">
          <td><v-icon icon="mdi-video"></v-icon> {{ $t('alerts.activeAlert.video') }}</td>
          <td>{{alert.video}}</td>
        </tr>
        <tr v-if="alert.lamp_color">
          <td><v-icon icon="mdi-lamp"></v-icon> {{ $t('alerts.activeAlert.lampColor') }}</td>
          <td>{{alert.lamp_color}}</td>
        </tr>
        </tbody>
      </v-table>

      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn
          variant="text"
          :color="alert.active ? 'error': ''"
          @click="removeAlert(alert['event-uuid'])"
        >
          <v-icon icon="mdi-trash-can"></v-icon>
        </v-btn>
      </v-card-actions>
    </v-expansion-panel-text>
  </v-expansion-panel>
</template>

<style scoped lang="scss">

</style>
