import BaseApi from "../../abstracts/BaseApi";
import isShieldActive, {disableShield, enableShield} from "../../helper/ShieldHelper";

export default class ShieldApi extends BaseApi {
    restEndpoint = 'shield'
    restPost = true
    websocketMethod = 'shield'

    async handle(data: any): Promise<any>
    {
        if(!data.state) return {"error": "missing state"}

        switch (data.state) {
            case 'activate':
            case 'true':
                void enableShield()
                break;
            case 'deactivate':
            case 'false':
                void disableShield()
                break;
            case 'toggle':
                if(isShieldActive()) {
                    void disableShield()
                } else {
                    void enableShield()
                }
                break;
            default: return {"error": "invalid state"}
        }
    }
}