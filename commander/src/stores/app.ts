// Utilities
import { defineStore } from 'pinia'

export const useAppStore = defineStore('app', {
  state: () => ({
    config: {
      websocketPort: 8100,
      webserverPort: 8105
    },
    games: []
  }),
  getters: {
    getConfig: (state) => state.config,
    getWebsocket: (state) => {
      return `ws://${location.hostname}:${state.config.websocketPort}`
    },
    getRestApi: (state) => {
      return `http://${location.hostname}:${state.config.webserverPort}`
    },
    getGames: (state) => state.games,
  },
  actions: {
    async fetchConfig() {
      const request = await fetch(`/config.json`)
      const config = await request.json()

      this.$patch(state => state.config = {
        websocketPort: config.websocket.port,
        webserverPort: config.webserver.port,
      })
    },
    async fetchGames() {
      const request = await fetch(`${this.getRestApi}/api/game/all`)
      const data = (await request.json()).data

      this.games = data

      this.$patch(state => state.games = data)
    }
  }
})
