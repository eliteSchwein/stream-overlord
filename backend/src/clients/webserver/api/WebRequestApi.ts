import BaseApi from "./BaseApi";
import {requestApi} from "../../website/WebsiteClient";

export default class WebRequestApi extends BaseApi {
    endpoint = 'web_request'
    post = true

    async handle(req: Request) {
        const body = req.body as any

        if(!body.method || !body.attributes) {
            return {
                error: 'method or attributes missing',
                status: 400
            }
        }

        let parsedAttributes = ''

        for(const attribute of body.attributes) {
            parsedAttributes = `&${attribute.key}=${attribute.value}`
        }

        const slug = `${body.method}${parsedAttributes}`
        const data = await requestApi(slug)

        return {
            status: 200,
            data: data
        }
    }
}