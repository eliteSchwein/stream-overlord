import BaseApi from "../../abstracts/BaseApi";
import {compressAssets} from "../../helper/AssetTuneHelper";

export default class CompressAssetsApi extends BaseApi {
    restEndpoint = 'recovery/compress_assets'

    async handle(data: any): Promise<any>
    {
        await compressAssets(true)
    }
}