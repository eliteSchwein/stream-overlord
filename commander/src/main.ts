/**
 * main.ts
 *
 * Bootstraps Vuetify and other plugins then mounts the App`
 */

// Plugins
import vuetify from '@/plugins/vuetify'
import router from '@/router'
import {createPinia} from "pinia";

// Components
import App from './App.vue'

// Composables
import { createApp } from 'vue'

const app = createApp(App)

app
  .use(createPinia())
  .use(vuetify)
  .use(router)

app.mount('#app')
