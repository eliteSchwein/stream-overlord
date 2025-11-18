import BaseApi from "../../abstracts/BaseApi";
import {getSourceFilters, saveSourceFilters} from "../../helper/SourceHelper";

export default class SaveSourcesApi extends BaseApi {
    restEndpoint = 'sources/save'
    websocketMethod = 'save_sources'

    async handle(data: any): Promise<any>
    {
        await saveSourceFilters()

        this.webSocketClient.send('notify_source_update', getSourceFilters())

        return getSourceFilters()
    }
}