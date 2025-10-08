import BaseApi from "../BaseApi";
import {compressAssets} from "../../../../helper/AssetTuneHelper";
import {reload} from "../../../../App";

export default class ReloadApi extends BaseApi {
    endpoint = 'recovery/reload'

    async handle(req: Request) {
        await reload()

        return {
            status: 200
        }
    }
}