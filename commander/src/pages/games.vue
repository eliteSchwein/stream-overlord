<template>
  <v-card
    class="overflow-auto mx-auto"
    max-height="100%"
    elevation="0"
  >
    <v-banner
      sticky
      lines="one"
      density="compact"
    >
      <v-text-field
        variant="outlined"
        label="Filter"
        density="compact"
        class="mt-5"
        v-model="filter"
        @input="filterGames"
      ></v-text-field>
    </v-banner>
    <v-row class="mx-3 my-2">
      <template v-for="(game, index) in games">
        <Game :game="game"></Game>
      </template>
    </v-row>
  </v-card>
</template>

<script lang="ts" setup>
import {useAppStore} from '@/stores/app';

const appOption = useAppStore()


const filter = ref<string | undefined>("")
const games = ref<any | undefined>([])

onMounted(async () => {
  games.value = appOption.getGames

  await appOption.fetchGames()

  games.value = appOption.getGames
})

function filterGames() {
  if(filter.value === "") {
    games.value = appOption.getGames
    return
  }

  const tempGames = appOption.getGames
  games.value = tempGames.filter(game =>
    // @ts-ignore
    game.game_name.toLowerCase().includes(filter.value.toLowerCase())
  )
}
</script>
