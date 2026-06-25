import BaseMessage from "@/plugins/websocketEvents/websocketMessage/BaseMessage.ts";

export default class NotifyVariableUpdateMessage extends BaseMessage {
  method = 'notify_variables_update'

  async handle(data:any) {
    this.store.setVariables(data)
  }
}
