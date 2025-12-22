import {OBSClient} from "../OBSClient";
import {logRegular} from "../../../helper/LogHelper";

export default abstract class BaseEvent {
    obsClient: OBSClient

    name: string
    eventTypes: string[]

    public constructor(obsClient: OBSClient) {
        this.obsClient = obsClient
    }

    register() {
        logRegular(`register event ${this.name}`)

        for(const eventType of this.eventTypes) {
            // @ts-ignore
            this.obsClient.getOBSWebSocket().on(eventType, (data: any) => void this.handle(data, eventType))
        }
    }

    async handle(data: any, eventType: string = '')
    {

    }
}