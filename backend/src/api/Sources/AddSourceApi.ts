import BaseApi from "../../abstracts/BaseApi";
import {addSource, getSourceFilters, updateSourceFilters} from "../../helper/SourceHelper";

export default class AddSourceApi extends BaseApi {
    restEndpoint = 'sources/add'
    websocketMethod = 'add_source'

    async handle(data: any): Promise<any>
    {
        const name = String(data?.name ?? '').trim()
        const uuid = String(data?.uuid ?? '').trim()
        const obsId = String(data?.obs_id ?? data?.obsId ?? data?.connection ?? 'default').trim() || 'default'

        if(!name || !uuid) {
            return {
                success: false,
                error: 'name and uuid are required'
            }
        }

        const result = await addSource(name, uuid, obsId)

        await updateSourceFilters()
        this.webSocketClient.send('notify_source_update', getSourceFilters())

        return {
            success: true,
            result,
            sources: getSourceFilters()
        }
    }
}
