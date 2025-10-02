<template>
  <v-card
    class="overflow-auto mx-auto"
    max-height="100%"
    max-width="100%"
    elevation="0"
    color="transparent"
  >
    <template v-if="getConnections.length === 0">
      <v-alert
        class="mt-5 mx-5"
        type="info"
        color="gray-darken-3"
        text="There are currently no active connections!"
      ></v-alert>
    </template>
    <template v-else>
      <div
        class="mt-5 mx-5">
        <v-expansion-panels
        >
          <v-expansion-panel
            v-for="(connection, client) in getConnections"
            color="grey-darken-3"
            :title="'Connection: ' + client"
          >
            <v-expansion-panel-text class="pa-0">
              <v-table>
                <thead>
                <tr>
                  <th class="text-left" style="width: 220px">
                    Active Endpoints
                  </th>
                </tr>
                </thead>
                <tbody>
                <tr>
                  <td>{{connection}}</td>
                </tr>
                </tbody>
              </v-table>

              <v-card-actions>
                <v-spacer></v-spacer>
                <v-btn
                  prepend-icon="mdi-lan-disconnect"
                  color="error"
                  @click="disconnectClient(client)"
                >
                  Disconnect
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
    ...mapState(useAppStore, ['getConnections']),
  },
  methods: {
    disconnectClient(client: string) {
      eventBus.$emit('websocket:send', {
        method: 'disconnect_connection',
        params: {'client': client}
      })
    }
  }
}
</script>

<style lang="scss">
</style>
