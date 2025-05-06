import BaseApi from "./BaseApi";
import {triggerMacro} from "../../../helper/MacroHelper";

export default class MacroApi extends BaseApi {
    endpoint = 'macro'
    post = true

    async handle(req: Request) {
        const body = req.body as any

        if(!body.macro) {
            return {
                error: 'macro missing',
                status: 400
            }
        }

        if(!await triggerMacro(body.macro)) {
            return {
                error: 'macro not found',
                status: 404
            }
        }

        return {
            status: 200
        }
    }
}