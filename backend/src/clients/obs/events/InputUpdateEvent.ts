import BaseEvent from "./BaseEvent";

export default class InputUpdateEvent extends BaseEvent {
    name = 'input_update'
    eventTypes = [
        "InputActiveStateChanged",
        "InputAudioBalanceChanged",
        "SceneItemCreated",
        "InputVolumeChanged",
        "InputMuteStateChanged",
        "InputShowStateChanged",
    ]

    async handle(data: any, eventType: string = '') {
        const updateData: any = {}
        switch (eventType) {
            case 'InputVolumeChanged':
                updateData.volume = data
                break
            case 'InputMuteStateChanged':
                updateData.muted = data.inputMuted
                break
            case 'InputAudioBalanceChanged':
                updateData.balance = data.inputAudioBalance
                break
            default:
                console.log('eventType', eventType)
                console.log('data', data)
                return
        }

        this.obsClient.updateAudio(data.inputUuid, updateData)
    }
}