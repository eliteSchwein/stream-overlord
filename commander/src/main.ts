/**
 * main.ts
 *
 * Bootstraps Vuetify and other plugins then mounts the App`
 */

// Plugins
import vuetify from '@/plugins/vuetify'
import router from '@/router'
import {createPinia} from "pinia";
import { i18n } from './plugins/i18n'

// Components
import App from './App.vue'

// Composables
import { createApp } from 'vue'

const app = createApp(App)

app
  .use(createPinia())
  .use(vuetify)
  .use(router)
  .use(i18n)

app.mount('#app')
