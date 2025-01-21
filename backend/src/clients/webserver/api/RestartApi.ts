import BaseApi from "./BaseApi";

export default class RestartApi extends BaseApi {
    endpoint = 'restart'

    async handle(req: Request) {
        setTimeout(() => {
            process.exit(1)
        }, 250)

        return {
            status: 200
        }
    }
}