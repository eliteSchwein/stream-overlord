<script lang="ts">
import {mapState} from "pinia";
import {useAppStore} from "@/stores/app";

export default {
  computed: {
    ...mapState(useAppStore, ['getCurrentGame']),
  }
}
</script>


<template>
  <v-card>
    <v-toolbar
      flat
      density="compact"
    >
      <v-toolbar-title class="d-flex align-center">
        {{ $t('currentGame.title') }}
      </v-toolbar-title>
    </v-toolbar>
    <v-card-text>
      <v-row>
        <v-col cols="auto">
          <Game :game="getCurrentGame"></Game>
        </v-col>
        <v-col>
          <v-table>
            <tbody>
            <tr>
              <td>
                {{ $t('currentGame.gameId') }}
              </td>
              <td>
                {{getCurrentGame.game_id}}
              </td>
            </tr>
            <tr>
              <td>
                {{ $t('currentGame.deaths') }}
              </td>
              <td>
                {{getCurrentGame.deaths}}
              </td>
            </tr>
            <tr>
              <td>
                {{ $t('currentGame.tags') }}
              </td>
              <td>
                {{ (getCurrentGame?.tags || []).map(a => a.name).join(', ') }}
              </td>
            </tr>
            <tr>
              <td>
                {{ $t('currentGame.channelPoints') }}
              </td>
              <td>
                {{ (getCurrentGame?.channel_points || []).map(a => a.name).join(', ') }}
              </td>
            </tr>
            </tbody>
          </v-table>
        </v-col>
      </v-row>
    </v-card-text>
  </v-card>
</template>

<style scoped lang="scss">

</style>
