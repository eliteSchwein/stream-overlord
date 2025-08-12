import BaseApi from "../BaseApi";
import {getTauonmbClient} from "../../../../App";

export default class TauonBackApi extends BaseApi {
    endpoint = 'music/back'

    async handle(req: Request) {
        const tauonmbClient = getTauonmbClient()

        await tauonmbClient.back()

        return {
            status: 200
        }
    }
}