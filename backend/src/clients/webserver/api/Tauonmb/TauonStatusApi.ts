import BaseApi from "../BaseApi";
import {getTauonmbClient} from "../../../../App";

export default class TauonStatusApi extends BaseApi {
    endpoint = 'music/status'

    async handle(req: Request) {
        const tauonmbClient = getTauonmbClient()
        const data = tauonmbClient?.getStatus()

        return {
            status: 200,
            data: data
        }
    }
}