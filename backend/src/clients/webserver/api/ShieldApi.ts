import BaseApi from "./BaseApi";
import isShieldActive, {disableShield, enableShield} from "../../../helper/ShieldHelper";

export default class ShieldApi extends BaseApi {
    endpoint = 'shield'
    post = true

    async handle(req: Request) {
        const body = req.body as any

        if (!body.method) {
            return {
                error: 'method or data missing',
                status: 400
            }
        }

        const method = body.method

        switch (method) {
            case 'activate':
                void enableShield()
                break;
            case 'deactivate':
                void disableShield()
                break;
            case 'toggle':
                if(isShieldActive()) {
                    void disableShield()
                } else {
                    void enableShield()
                }
                break;
            default:
                return {
                    error: 'method invalid',
                    status: 400
                }
        }

        return {
            status: 200
        }
    }
}