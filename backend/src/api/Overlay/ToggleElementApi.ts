import BaseApi from "../../abstracts/BaseApi";

export default class ToggleElementApi extends BaseApi {
    restEndpoint = 'toggle_element'
    restPost = true
    websocketMethod = 'toggle_element'

    async handle(data: any): Promise<any>
    {
        if(!data.state) return {"error": "missing state"}
        if(!data.target) return {"error": "missing target"}

        const target = data.target

        switch (data.state()) {
            case 'enable':
                this.webSocketClient.send('notify_toggle_element', {target: target, action: 'enable'})
                break
            case 'disable':
                this.webSocketClient.send('notify_toggle_element', {target: target, action: 'disable'})
                break
            case 'toggle':
                this.webSocketClient.send('notify_toggle_element', {target: target})
                break
            default:
                return {
                    error: 'method invalid'
                }
        }
    }
}