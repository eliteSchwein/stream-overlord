import BaseController from "./BaseController";
import {Websocket} from "websocket-ts";
import {sleep} from "../../../../helper/GeneralHelper";

export default class RandomClipsController extends BaseController {
    websocketEndpoints = ["notify_random_clips"];

    static targets = ["channelname", "iframe"];

    declare readonly channelnameTargets: HTMLElement[];
    declare readonly iframeTarget: HTMLIFrameElement;

    async handleMessage(websocket: Websocket, method: string, data: any) {
        if (method !== "notify_random_clips") return;

        if (data?.action === "disable") {
            await this.disable();
            return;
        }

        if (data?.action !== "enable") return;

        this.element.classList.add("visible");
        this.iframeTarget.style.display = "";
        this.iframeTarget.src = data?.url || this.parseData(data, this.iframeTarget.dataset.src || "");

        this.channelnameTargets.forEach((element) => {
            element.textContent = data?.name || data?.channel || "";
        });
    }

    private async disable() {
        this.iframeTarget.src = "";
        this.iframeTarget.style.display = "none";

        await sleep(1000);
        this.element.classList.remove("visible");
    }

    private parseData(data: any, input: string): string {
        return input
            .replace("${channel}", data?.channel ?? "")
            .replace("${channelname}", data?.name ?? "");
    }
}
