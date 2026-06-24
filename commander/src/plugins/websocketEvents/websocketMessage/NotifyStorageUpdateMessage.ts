import BaseMessage from "@/plugins/websocketEvents/websocketMessage/BaseMessage.ts";

export default class NotifyStorageUpdateMessage extends BaseMessage {
  method = 'notify_storage_update'

  async handle(data: any) {
    this.store.setStorage(data)
  }
}
