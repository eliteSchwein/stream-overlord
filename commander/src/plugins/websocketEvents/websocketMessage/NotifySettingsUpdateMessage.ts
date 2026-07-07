import BaseMessage from "@/plugins/websocketEvents/websocketMessage/BaseMessage";

export default class NotifySettingsUpdateMessage extends BaseMessage {
  method = 'notify_settings_update'

  async handle(data: any) {
    this.store.setSettings(data)
  }
}
