import { Websocket, WebsocketEvent } from "websocket-ts";
import { getConfig } from "../helper/ConfigHelper";
import { getRandomInt, sleep } from "../../../../helper/GeneralHelper";

declare global {
    interface Window {
        websocket?: Websocket;
        __appTeardown?: () => void;
    }
}

export default class WebsocketClient {
    private websocket!: Websocket;
    private url!: string;

    // reconnect/backoff settings
    private reconnecting = false;
    private hasReloadedAfterReconnect = false;
    private baseDelayMs = 2_000;
    private maxDelayMs = 60_000;

    // soft reload guard
    private softReloadInProgress = false;

    public async connect() {
        const config = getConfig(/websocket/g)[0];
        this.url = `ws://${window.location.hostname}:${config.port}`;
        this.openWebsocket();
        await sleep(500);
    }

    private openWebsocket() {
        if (window.websocket) {
            this.websocket = window.websocket;
            return;
        }

        this.websocket = new Websocket(this.url);

        this.websocket.addEventListener(WebsocketEvent.open, () => {
            console.log("Websocket connected");
            window.websocket = this.websocket;

            this.registerEndpoints([
                "notify_game_update",
                "notify_shield_mode",
                "notify_test_mode",
            ]);

            if (this.reconnecting && !this.hasReloadedAfterReconnect) {
                this.hasReloadedAfterReconnect = true;
                void this.softReloadPage();
                return;
            }

            this.reconnecting = false;
        });

        this.websocket.addEventListener(WebsocketEvent.close, (event) => {
            console.log("Websocket closed", event);

            if (window.websocket === this.websocket) {
                delete window.websocket;
            }

            if (!this.reconnecting) {
                this.reconnecting = true;
                this.hasReloadedAfterReconnect = false;
                void this.tryReconnect();
            }
        });

        this.websocket.addEventListener(WebsocketEvent.error, (event) => {
            console.warn("Websocket error", event);
        });

        window.websocket = this.websocket;
    }

    private async tryReconnect() {
        let attempt = 0;

        while (this.reconnecting) {
            attempt++;

            const delay = Math.min(
                this.baseDelayMs * 2 ** (attempt - 1),
                this.maxDelayMs
            );
            const jitter = delay * (0.75 + Math.random() * 0.5);

            console.log(
                `Reconnecting WebSocket (attempt ${attempt}) in ${Math.round(jitter)}ms...`
            );

            await sleep(jitter);

            try {
                delete window.websocket;
                this.openWebsocket();

                const opened = await this.waitForOpen(5_000);
                if (opened) {
                    return;
                }

                try {
                    this.websocket.close();
                } catch {}
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

    private async softReloadPage() {
        if (this.softReloadInProgress) return;
        this.softReloadInProgress = true;

        try {
            console.log("[soft-reload] start");

            const oldStyles = this.getCurrentStyles();
            const oldScripts = this.getCurrentScripts();

            const response = await fetch(this.withCacheBust(window.location.href), {
                method: "GET",
                cache: "no-store",
                credentials: "same-origin",
                headers: {
                    "X-Soft-Reload": "1",
                },
            });

            if (!response.ok) {
                throw new Error(
                    `Failed to fetch fresh HTML: ${response.status} ${response.statusText}`
                );
            }

            const html = await response.text();
            const nextDoc = new DOMParser().parseFromString(html, "text/html");

            const nextStyles = Array.from(
                nextDoc.querySelectorAll('link[rel="stylesheet"], style')
            ) as Array<HTMLLinkElement | HTMLStyleElement>;

            const nextScripts = Array.from(
                nextDoc.querySelectorAll("script")
            ).filter((script) =>
                this.shouldReloadScript(script as HTMLScriptElement)
            ) as HTMLScriptElement[];

            // 1) load CSS first
            await this.loadStyles(nextStyles);

            // 2) swap HTML
            this.syncHeadStaticNodes(nextDoc);
            this.swapHtml(nextDoc);

            // optional app cleanup hook
            if (typeof window.__appTeardown === "function") {
                try {
                    window.__appTeardown();
                } catch (e) {
                    console.warn("[soft-reload] teardown failed", e);
                }
            }

            // clear old websocket singleton before new JS boots
            try {
                this.websocket.close();
            } catch {}
            delete window.websocket;

            // 3) load JS
            await this.loadScripts(nextScripts);

            // 4) unload old CSS + JS tags
            oldStyles.forEach((node) => {
                try {
                    node.remove();
                } catch {}
            });

            oldScripts.forEach((node) => {
                try {
                    node.remove();
                } catch {}
            });

            console.log("[soft-reload] done");
        } catch (e) {
            console.error("[soft-reload] failed, falling back to hard reload", e);
            window.location.reload();
        } finally {
            this.softReloadInProgress = false;
            this.reconnecting = false;
        }
    }

    private getCurrentStyles(): HTMLElement[] {
        return Array.from(
            document.querySelectorAll('link[rel="stylesheet"], style')
        ).filter((node) => {
            const el = node as HTMLElement;
            return !el.hasAttribute("data-soft-reload-ignore");
        }) as HTMLElement[];
    }

    private getCurrentScripts(): HTMLScriptElement[] {
        return Array.from(document.querySelectorAll("script")).filter((node) => {
            const script = node as HTMLScriptElement;
            return (
                this.shouldReloadScript(script) &&
                !script.hasAttribute("data-soft-reload-ignore")
            );
        }) as HTMLScriptElement[];
    }

    private shouldReloadScript(script: HTMLScriptElement): boolean {
        const type = (script.getAttribute("type") || "").trim().toLowerCase();

        if (script.hasAttribute("data-soft-reload-ignore")) return false;
        if (type === "application/json") return false;
        if (type === "application/ld+json") return false;
        if (type === "importmap") return false;
        if (type === "speculationrules") return false;

        return true;
    }

    private async loadStyles(styles: Array<HTMLLinkElement | HTMLStyleElement>) {
        const promises = styles.map((style) => {
            return new Promise<void>((resolve, reject) => {
                const tag = style.tagName.toLowerCase();

                if (tag === "link") {
                    const source = style as HTMLLinkElement;
                    const link = document.createElement("link");

                    for (const attr of Array.from(source.attributes)) {
                        if (attr.name.toLowerCase() === "href") continue;
                        link.setAttribute(attr.name, attr.value);
                    }

                    link.rel = source.rel || "stylesheet";
                    link.href = this.withCacheBust(source.href);
                    link.setAttribute("data-soft-reload-new", "1");

                    link.onload = () => resolve();
                    link.onerror = () =>
                        reject(new Error(`Failed to load stylesheet: ${source.href}`));

                    document.head.appendChild(link);
                    return;
                }

                const inlineStyle = document.createElement("style");
                inlineStyle.textContent = style.textContent || "";
                inlineStyle.setAttribute("data-soft-reload-new", "1");
                document.head.appendChild(inlineStyle);
                resolve();
            });
        });

        await Promise.all(promises);
    }

    private async loadScripts(scripts: HTMLScriptElement[]) {
        for (const source of scripts) {
            await new Promise<void>((resolve, reject) => {
                const script = document.createElement("script");

                for (const attr of Array.from(source.attributes)) {
                    if (attr.name.toLowerCase() === "src") continue;
                    script.setAttribute(attr.name, attr.value);
                }

                script.setAttribute("data-soft-reload-new", "1");

                const parent =
                    source.parentElement?.tagName.toLowerCase() === "head"
                        ? document.head
                        : document.body;

                if (source.src) {
                    script.async = false;
                    script.defer = false;
                    script.src = this.withCacheBust(source.src);
                    script.onload = () => resolve();
                    script.onerror = () =>
                        reject(new Error(`Failed to load script: ${source.src}`));
                    parent.appendChild(script);
                    return;
                }

                script.textContent = source.textContent || "";
                parent.appendChild(script);
                resolve();
            });
        }
    }

    private syncHeadStaticNodes(nextDoc: Document) {
        document.title = nextDoc.title;

        const currentStaticNodes = Array.from(document.head.children).filter(
            (node) => {
                const el = node as HTMLElement;
                const tag = el.tagName.toLowerCase();

                if (el.hasAttribute("data-soft-reload-ignore")) return false;
                if (tag === "script") return false;
                if (tag === "style") return false;
                if (tag === "link" && (el as HTMLLinkElement).rel === "stylesheet") {
                    return false;
                }

                return true;
            }
        );

        currentStaticNodes.forEach((node) => node.remove());

        const nextStaticNodes = Array.from(nextDoc.head.children).filter((node) => {
            const el = node as HTMLElement;
            const tag = el.tagName.toLowerCase();

            if (tag === "script") return false;
            if (tag === "style") return false;
            if (tag === "link" && (el as HTMLLinkElement).rel === "stylesheet") {
                return false;
            }

            return true;
        });

        nextStaticNodes.forEach((node) => {
            document.head.appendChild(document.importNode(node, true));
        });
    }

    private swapHtml(nextDoc: Document) {
        this.syncAttributes(
            document.documentElement as HTMLElement,
            nextDoc.documentElement as HTMLElement
        );

        const newBody = document.importNode(nextDoc.body, true) as HTMLBodyElement;
        document.documentElement.replaceChild(newBody, document.body);
    }

    private syncAttributes(target: HTMLElement, source: HTMLElement) {
        for (const attr of Array.from(target.attributes)) {
            target.removeAttribute(attr.name);
        }

        for (const attr of Array.from(source.attributes)) {
            target.setAttribute(attr.name, attr.value);
        }
    }

    private withCacheBust(url: string): string {
        const fullUrl = new URL(url, window.location.href);
        fullUrl.searchParams.set(
            "_soft_reload",
            `${Date.now()}_${Math.random().toString(36).slice(2)}`
        );
        return fullUrl.toString();
    }

    public getWebsocket() {
        return this.websocket;
    }

    public send(method: string, data: any = {}) {
        this.websocket.send(
            JSON.stringify({
                jsonrpc: "2.0",
                method,
                params: data,
                id: getRandomInt(10_000),
            })
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