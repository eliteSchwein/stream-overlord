import {getAssetConfig, getConfig} from "../../helper/ConfigHelper";
import {logWarn, logSuccess, logDebug} from "../../helper/LogHelper";
import getWebsocketServer from "../../App";

export default class TauonmbClient {
    protected disabled = false
    protected config: any
    protected status: any = null

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
        if(this.disabled) return

        logDebug('sync tauonmb')

        try {
            const request = await fetch(`${this.config.url}status`)

            if(!this.status) {
                logSuccess('tauonmb client first sync successful')
            }

            this.status = await request.json()

            getWebsocketServer().send('notify_tauonmb', this.status)
        } catch (error) {
            logDebug('tauonmb sync failed:')
            logDebug(JSON.stringify(error, Object.getOwnPropertyNames(error)))
        }
    }
}