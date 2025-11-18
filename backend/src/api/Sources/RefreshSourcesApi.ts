import BaseApi from "../../abstracts/BaseApi";
import {getSourceFilters, updateSourceFilters} from "../../helper/SourceHelper";

export default class RefreshSourcesApi extends BaseApi {
    restEndpoint = 'sources/refresh'
    websocketMethod = 'refresh_sources'

    async handle(data: any): Promise<any>
    {
        await updateSourceFilters()

        this.webSocketClient.send('notify_source_update', getSourceFilters())

        return getSourceFilters()
    }
}