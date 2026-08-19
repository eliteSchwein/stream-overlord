import BaseApi from "../../abstracts/BaseApi";
import {getOBSClient} from "../../App";

export default class TriggerObsCommandApi extends BaseApi {
    restEndpoint = 'obs'
    restPost = true
    websocketMethod = 'obs_trigger_command'

    async handle(data: any): Promise<any>
    {
        const obsClient = getOBSClient()
        const connectionName = String(
            data?.connection
            ?? data?.obs_id
            ?? 'default'
        )

        await obsClient.send(
            data.method,
            data.data,
            connectionName,
        );
    }
}
