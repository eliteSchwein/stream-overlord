import BaseMessage from "@/plugins/websocketEvents/websocketMessage/BaseMessage";

export default class NotifyCommandsUpdateMessage extends BaseMessage {
  method = 'notify_commands_update'

  async handle(data: any) {
    this.store.setCommands(data?.commands ?? {})
  }
}
