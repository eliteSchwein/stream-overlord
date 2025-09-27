import { Websocket, WebsocketEvent } from "websocket-ts";
import { getConfig } from "../helper/ConfigHelper";
import { getRandomInt, sleep } from "../../../../helper/GeneralHelper";

export default class WebsocketClient {
    private websocket!: Websocket;
    private url!: string;

    // reconnect/backoff settings
    private reconnecting = false;
    private hasReloadedAfterReconnect = false;
    private baseDelayMs = 500;    // initial backoff
    private maxDelayMs = 30_000;  // cap backoff at 30s

    public async connect() {
        const config = getConfig(/websocket/g)[0];
        this.url = `ws://${window.location.hostname}:${config.port}`;
        this.openWebsocket();
        await sleep(250);
    }

    private openWebsocket() {
        this.websocket = new Websocket(this.url);

        this.websocket.addEventListener(WebsocketEvent.open, () => {
            console.log("Websocket connected");
            this.registerEndpoints(["notify_game_update", "notify_shield_mode"]);

            // If we just reconnected (after a close), reload once
            if (this.reconnecting && !this.hasReloadedAfterReconnect) {
                this.hasReloadedAfterReconnect = true;
                // @ts-ignore
                location.reload(true);
            }

            // Reset state after a clean (re)connect
            this.reconnecting = false;
        });

        this.websocket.addEventListener(WebsocketEvent.close, (event) => {
            console.log("Websocket closed", event);
            // Start reconnect loop (no immediate reload)
            if (!this.reconnecting) {
                this.reconnecting = true;
                this.hasReloadedAfterReconnect = false;
                this.tryReconnect();
            }
        });

        this.websocket.addEventListener(WebsocketEvent.error, (event) => {
            // Errors will usually be followed by a close; log for visibility.
            console.warn("Websocket error", event);
        });
    }

    private async tryReconnect() {
        let attempt = 0;

        while (this.reconnecting) {
            attempt++;
            const delay = Math.min(this.baseDelayMs * 2 ** (attempt - 1), this.maxDelayMs);
            // Add jitter (+/- 25%) to avoid thundering herd if many clients reconnect
            const jitter = delay * (0.75 + Math.random() * 0.5);

            console.log(`Reconnecting WebSocket (attempt ${attempt}) in ${Math.round(jitter)}ms...`);
            await sleep(jitter);

            try {
                // Open a fresh socket instance and attach listeners
                this.openWebsocket();

                // Wait a short grace period to see if 'open' arrives
                const opened = await this.waitForOpen(5_000);
                if (opened) {
                    // 'open' handler will reload the page exactly once.
                    return;
                } else {
                    // If not opened within grace period, force close and retry
                    try { this.websocket.close(); } catch {}
                }
            } catch (e) {
                console.warn("Reconnect attempt failed to initialize:", e);
            }
        }
    }

    private waitForOpen(timeoutMs: number): Promise<boolean> {
        return new Promise((resolve) => {
            let settled = false;

            const onOpen = () => {
                if (!settled) {
                    settled = true;
                    cleanup();
                    resolve(true);
                }
            };

            const onCloseOrError = () => {
                if (!settled) {
                    settled = true;
                    cleanup();
                    resolve(false);
                }
            };

            const cleanup = () => {
                try {
                    this.websocket.removeEventListener(WebsocketEvent.open, onOpen);
                    this.websocket.removeEventListener(WebsocketEvent.close, onCloseOrError);
                    this.websocket.removeEventListener(WebsocketEvent.error, onCloseOrError);
                } catch {}
            };

            this.websocket.addEventListener(WebsocketEvent.open, onOpen);
            this.websocket.addEventListener(WebsocketEvent.close, onCloseOrError);
            this.websocket.addEventListener(WebsocketEvent.error, onCloseOrError);

            setTimeout(() => {
                if (!settled) {
                    settled = true;
                    cleanup();
                    resolve(false);
                }
            }, timeoutMs);
        });
    }

    public getWebsocket() {
        return this.websocket;
    }

    public send(method: string, data: any = {}) {
        this.websocket.send(
            JSON.stringify({ jsonrpc: "2.0", method, params: data, id: getRandomInt(10_000) })
        );
    }

    public editColor(color: string | undefined = undefined) {
        this.send("set_color", { color });
    }

    public clearEvent(eventUuid: string) {
        this.send("remove_event", { "event-uuid": eventUuid });
    }

    public registerEndpoint(endpoint: string): void {
        this.send("register_endpoints", [endpoint]);
    }

    public registerEndpoints(endpoints: string[]): void {
        if (endpoints.length === 0) return;
        this.send("register_endpoints", endpoints);
    }
}
