import BaseApi from "../../abstracts/BaseApi";
import {compressAssets} from "../../helper/AssetTuneHelper";
import {unlinkSync} from "node:fs";
import {resolve} from "node:path";
import {isDebug, logDebug, logError, logWarn} from "../../helper/LogHelper";

export default class DeleteAuthApi extends BaseApi {
    restEndpoint = 'recovery/delete_auth'

    async handle(data: any): Promise<any>
    {
        try {
            unlinkSync(resolve(`${__dirname}/../../twitchTokens.json`))
        } catch (error) {
            if (isDebug()) {
                logWarn(`Deleting Twitch Auth failed:`);
                logWarn(error.stderr?.toString());
            }
            logWarn(`Deleting Twitch Auth failed`);
        }
    }
}