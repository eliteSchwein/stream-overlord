import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import vuetify, { transformAssetUrls } from "vite-plugin-vuetify";
import { fileURLToPath, URL } from "node:url";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
    plugins: [
        vue({
            template: { transformAssetUrls },
        }),
        vuetify({
            autoImport: true,
            styles: {
                configFile: "src/styles/settings.scss",
            },
        }),
    ],

    clearScreen: false,

    server: {
        port: 1420,
        strictPort: true,
        host: host || false,
        hmr: host
            ? {
                protocol: "ws",
                host,
                port: 1421,
            }
            : undefined,
        watch: {
            ignored: ["**/src-tauri/**"],
        },
        warmup: {
            clientFiles: [
                "./index.html",
                "./src/main.ts",
                "./src/App.vue",
                "./src/plugins/**/*.{ts,js}",
                "./src/layouts/**/*.vue",
                "./src/components/**/*.vue",
                "./src/pages/**/*.vue",
                "./src/styles/settings.scss",
            ],
        },
    },

    resolve: {
        alias: {
            "@": fileURLToPath(new URL("./src", import.meta.url)),
        },
        extensions: [
            ".js",
            ".json",
            ".jsx",
            ".mjs",
            ".ts",
            ".tsx",
            ".vue",
        ],
    },

    optimizeDeps: {
        include: [
            "vue",
            "vuetify",
        ],
    },
});