import BaseApi from "../../abstracts/BaseApi";
import {setTestModeActive} from "../../helper/VisibleHelper";

export default class ToggleTestOverlayModeApi extends BaseApi {
    restEndpoint = 'overlay/test_mode'
    restPost = true
    websocketMethod = 'toggle_test_mode'

    async handle(data: any): Promise<any>
    {
        await setTestModeActive(data.active)
    }
}