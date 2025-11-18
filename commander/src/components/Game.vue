<script setup lang="ts">
import {sleep} from "@/helper/GeneralHelper";
import { useAppStore } from '@/stores/app';

const appOption = useAppStore();

defineProps({
  game: {}
})

const loading = ref<boolean | undefined>(false);

async function changeGame( event: Event, gameId: string) {
  loading.value = true

  await fetch(`${appOption.getRestApi}/api/games/set`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({game_id: gameId})
  })

  await sleep(1000)
  loading.value = false
}
</script>

<template>
    <div class="game-container"
         @click.stop="changeGame($event, game?.game_id)"
    >
      <v-img
        :class="{darken: loading}"
        style="border-radius: 10px"
        :width="150"
        aspect-ratio="16/9"
        cover
        :src="game?.media?.cover"
      />
      <template v-if="loading">
        <div class="game-content">
          <v-progress-circular
            indeterminate
          ></v-progress-circular>
        </div>
      </template>
    </div>
</template>

<style scoped lang="scss">
.game-container {
  position: relative;
  width: max-content;

  .v-img.darken {
    filter: brightness(75%);
    transition-duration: 0.2s;
  }

  .game-content {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
  }
}
</style>
