import BaseApi from "../BaseApi";
import {compressAssets} from "../../../../helper/AssetTuneHelper";

export default class CompressAssetsApi extends BaseApi {
    endpoint = 'recovery/compress_assets'

    async handle(req: Request) {
        await compressAssets(true)

        return {
            status: 200
        }
    }
}