import BaseApi from "../BaseApi";
import {getTauonmbClient} from "../../../../App";

export default class TauonNextApi extends BaseApi {
    endpoint = 'music/next'

    async handle(req: Request) {
        const tauonmbClient = getTauonmbClient()

        await tauonmbClient.next()

        return {
            status: 200
        }
    }
}