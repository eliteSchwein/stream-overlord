const messageEventMap = new Map<string, string>()

export function linkMessageToEvent(messageId: string | undefined, eventUuid: string | undefined) {
    if (!messageId || !eventUuid) return
    messageEventMap.set(messageId, eventUuid)
}

export function getEventUuidByMessageId(messageId: string | undefined) {
    if (!messageId) return undefined
    return messageEventMap.get(messageId)
}

export function unlinkMessage(messageId: string | undefined) {
    if (!messageId) return
    messageEventMap.delete(messageId)
}

export function unlinkEvent(eventUuid: string | undefined) {
    if (!eventUuid) return

    for (const [messageId, linkedEventUuid] of messageEventMap.entries()) {
        if (linkedEventUuid === eventUuid) {
            messageEventMap.delete(messageId)
        }
    }
}