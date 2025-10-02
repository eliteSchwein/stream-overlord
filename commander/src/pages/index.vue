<template>
  <v-card
    class="overflow-auto mx-auto"
    max-height="100%"
    max-width="100%"
    elevation="0"
    color="transparent"
  >
    <template v-if="getAlerts.length === 0">
      <v-alert
        class="mt-5 mx-5"
        type="info"
        color="gray-darken-3"
        text="There are currently no alerts in the Query!"
      ></v-alert>
    </template>
    <template v-else>
      <div
        class="mt-5 mx-5">
        <v-expansion-panels
        >
          <v-expansion-panel
            v-for="(alert) in getAlerts"
            :color="alert.active ? 'green-darken-2' : 'grey-darken-3'"
            :title="'Alert: ' + alert['event-uuid'] + ' - ' + formatSeconds(alert.duration)"
          >
            <v-expansion-panel-text class="pa-0">
              <v-table>
                <thead>
                  <tr>
                    <th class="text-left" style="width: 220px">
                      Name
                    </th>
                    <th class="text-left">
                      Value
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><v-icon icon="mdi-broadcast"></v-icon> Channel</td>
                    <td>{{alert.channel}}</td>
                  </tr>
                  <tr v-if="alert.icon">
                    <td><v-icon icon="mdi-circle-slice-1"></v-icon> Icon</td>
                    <td>{{alert.icon}}</td>
                  </tr>
                  <tr v-if="alert.message">
                    <td><v-icon icon="mdi-message"></v-icon> Message</td>
                    <td>{{alert.message}}</td>
                  </tr>
                  <tr v-if="alert.sound">
                    <td><v-icon icon="mdi-volume-low"></v-icon> Sound</td>
                    <td>{{alert.sound}}</td>
                  </tr>
                  <tr v-if="alert.video">
                    <td><v-icon icon="mdi-video"></v-icon> Video</td>
                    <td>{{alert.video}}</td>
                  </tr>
                  <tr v-if="alert.lamp_color">
                    <td><v-icon icon="mdi-lamp"></v-icon> Lamp Color</td>
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
        </v-expansion-panels>
      </div>
    </template>
  </v-card>
</template>

<script lang="ts">
import {mapState} from "pinia";
import {useAppStore} from "@/stores/app";
import eventBus from "@/eventBus";

export default {
  computed: {
    ...mapState(useAppStore, ['getAlerts']),
  },
  methods: {
    formatSeconds(totalSeconds) {
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      return [
        hours > 0 ? String(hours).padStart(2, '0') : null,
        String(minutes).padStart(2, '0'),
        String(seconds).padStart(2, '0')
      ]
        .filter(Boolean)
        .join(':');
    },
    removeAlert(eventUuid: string) {
      eventBus.$emit('websocket:send', {
        method: 'remove_event',
        params: {'event-uuid': eventUuid}
      })
    }
  }
}
</script>

<style lang="scss">
</style>
