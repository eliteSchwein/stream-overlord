import BaseApi from "../../abstracts/BaseApi";
import {requestApi} from "../../clients/website/WebsiteClient";

export default class WebRequestApi extends BaseApi {
    restEndpoint = 'web_request'
    restPost = true
    websocketMethod = 'web_request'

    async handle(data: any): Promise<any>
    {
        if(!data.url) return {"error": "missing url"}
        if(!data.attributes) return {"error": "missing attributes"}

        let parsedAttributes = ''

        for(const attribute of data.attributes) {
            parsedAttributes = `&${attribute.key}=${attribute.value}`
        }

        const slug = `${data.url}${parsedAttributes}`
        return await requestApi(slug)
    }
}