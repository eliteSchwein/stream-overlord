import BaseApi from "../../abstracts/BaseApi";
import {pushGameInfo, setManualColor} from "../../helper/GameHelper";

export default class EditColorApi extends BaseApi {
    restEndpoint = 'theme/edit_color'
    restPost = true
    websocketMethod = 'set_color'

    async handle(data: any): Promise<any>
    {
        const color = data.color

        setManualColor(color)
        pushGameInfo()
    }
}