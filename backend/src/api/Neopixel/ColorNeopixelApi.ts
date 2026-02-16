import BaseApi from "../../abstracts/BaseApi";
import {colorNeopixel} from "../../helper/NeopixelHelper";

export default class ColorNeopixelApi extends BaseApi {
    restEndpoint = 'neopixel/color'
    restPost = true
    websocketMethod = 'color_neopixel'

    async handle(data: any) {
        if(!data.name) return {"error": "missing name"}
        if(!data.color) return {"error": "missing color"}

        if(data.index) data.index = Number.parseInt(data.index)

        await colorNeopixel(data.name, data.color, data.index)
    }
}