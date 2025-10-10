import {getConfig} from "../../helper/ConfigHelper";
import {logDebug, logSuccess, logWarn} from "../../helper/LogHelper";
import getWebsocketServer from "../../App";

export default class TauonmbClient {
    protected disabled = false
    protected config: any
    protected status: any = null
    protected image = {
        trackId: '',
        small: '',
        medium: '',
    }

    public async init() {
        const config = getConfig(/api tauonmb/g)[0]

        if(!config) {
            this.disabled = true
            logWarn('tauonmb config not found')
            return
        }

        this.config = config

        await this.sync()

        if(!this.status) {
            logWarn('tauonmb first sync failed but client still ready')
        }

        logSuccess('tauonmb client is ready')
    }

    public async sync() {
        if (this.disabled) return;

        try {
            const request = await this.callEndpoint('status');

            const path = request?.track?.path ?? '';
            const filenameNoExt =
                path.split(/[\\/]/).pop()?.replace(/\.[^./\\]+$/,'')?.trim() ?? '';

            if (!request.title || !request.title.trim()) {
                request.title = filenameNoExt;
            }

            if (request.track && (!request.track.title || !request.track.title.trim())) {
                request.track.title = filenameNoExt;
            }

            if (!this.status) {
                logSuccess('tauonmb client first sync successful');
            }

            if (request.track.id !== this.image.trackId) {
                this.image.trackId = request.track.id;
                this.image.small = await this.callEndpoint(`pic/small/${request.track.id}`);
                this.image.medium = await this.callEndpoint(`pic/medium/${request.track.id}`);

                getWebsocketServer().send('notify_tauonmb_update', { image: this.image });
            }

            this.status = request;

            this.status.progress_percentage =
                (this.status.progress / this.status.track.duration) * 100;

            getWebsocketServer().send('notify_tauonmb_update', this.status);
        } catch (error) {
            logDebug('tauonmb sync failed:');
            logDebug(JSON.stringify(error, Object.getOwnPropertyNames(error)));
        }
    }


    public getStatus() {
        return { ...this.status, image: this.image }
    }

    private async callEndpoint(endpoint: string) {
        if(this.disabled) return

        logDebug(`call tauonmb endpoint: ${endpoint}`)

        try {
            const request = await fetch(`${this.config.url}${endpoint}`);
            const contentType = request.headers.get("content-type") || "";

            if (contentType.includes("application/json")) {
                return await request.json();
            }
            else if (contentType.startsWith("image/")) {
                const buffer = await request.arrayBuffer();
                const base64 = Buffer.from(buffer).toString("base64");
                return `data:${contentType};base64,${base64}`;
            }
            else {
                return await request.text();
            }

        } catch (error) {
            logDebug('tauonmb request failed:')
            logDebug(JSON.stringify(error, Object.getOwnPropertyNames(error)))
        }

        return null
    }

    public async next() {
        if(this.disabled) return

        return await this.callEndpoint('next')
    }

    public async play() {
        if(this.disabled) return

        return await this.callEndpoint('play')
    }

    public async pause() {
        if(this.disabled) return

        return await this.callEndpoint('pause')
    }

    public async back() {
        if(this.disabled) return

        return await this.callEndpoint('back')
    }

    public async setVolume(volume: number) {
        if(this.disabled) return

        return await this.callEndpoint(`setvolume/${volume}`)
    }

    public async setRelativeVolume(volume: number) {
        if(this.disabled) return

        return await this.callEndpoint(`setvolumerel/${volume}`)
    }
}