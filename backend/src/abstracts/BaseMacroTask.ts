import getWebsocketServer from "../App";

export default class BaseMacroTask {
    protected websocket = getWebsocketServer()
    channel: string = ''

    public async run(channel: string, method: string, data: any = {}, variables: any = {}) {
        if(this.channel !== channel) return

        await this.handle(method, data, variables)
    }

    async handle(method: string, data: any = {}, variables: any = {}) {

    }

    public getChannel() { return this.channel }
}