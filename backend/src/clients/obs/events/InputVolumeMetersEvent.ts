import BaseEvent from "./BaseEvent";
import {logRegular} from "../../../helper/LogHelper";

export default class InputVolumeMetersEvent extends BaseEvent {
    name = 'input_volume_meters';
    eventTypes = [
        "InputVolumeMeters"
    ];

    register() {
        logRegular(`register event ${this.name}`)

        for(const eventType of this.eventTypes) {
            // @ts-ignore
            this.obsClient.getMixerObsWebSocket().on(eventType, (data: any) => void this.handle(data))
        }
    }

    async handle(data: any) {
        //console.log(data)
    }
}