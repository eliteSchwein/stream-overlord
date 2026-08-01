import BaseMessage from "@/plugins/websocketEvents/websocketMessage/BaseMessage";

export default class NotifyPlaylistUpdateMessage extends BaseMessage {
  method = 'notify_playlist_update'

  async handle(data: any) {
    this.store.setMusicPlaylist(data)
  }
}
