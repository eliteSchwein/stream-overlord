type MessageEventLink = {
    eventUuid: string;
    createdAt: number;
};

const messageEventMap = new Map<string, MessageEventLink>()

// Message IDs are only needed for a short period to correlate delete events with
// interactions/alerts. Keeping them forever causes a slow, permanent heap leak.
const MESSAGE_EVENT_LINK_TTL_MS = 60 * 60 * 1000
const MESSAGE_EVENT_LINK_MAX_ENTRIES = 5000
let lastCleanupAt = 0

function cleanupMessageEventLinks(force = false) {
    const now = Date.now()
    if (!force && now - lastCleanupAt < 60_000 && messageEventMap.size <= MESSAGE_EVENT_LINK_MAX_ENTRIES) return
    lastCleanupAt = now

    for (const [messageId, link] of messageEventMap) {
        if (now - link.createdAt > MESSAGE_EVENT_LINK_TTL_MS) {
            messageEventMap.delete(messageId)
        }
    }

    // Hard bound as an additional safety net during very busy streams. Map keeps
    // insertion order, so trim the oldest entries first.
    while (messageEventMap.size > MESSAGE_EVENT_LINK_MAX_ENTRIES) {
        const oldest = messageEventMap.keys().next().value
        if (!oldest) break
        messageEventMap.delete(oldest)
    }
}

export function linkMessageToEvent(messageId: string | undefined, eventUuid: string | undefined) {
    if (!messageId || !eventUuid) return
    cleanupMessageEventLinks()
    messageEventMap.set(messageId, {eventUuid, createdAt: Date.now()})
}

export function getEventUuidByMessageId(messageId: string | undefined) {
    if (!messageId) return undefined
    const link = messageEventMap.get(messageId)
    if (!link) return undefined

    if (Date.now() - link.createdAt > MESSAGE_EVENT_LINK_TTL_MS) {
        messageEventMap.delete(messageId)
        return undefined
    }

    return link.eventUuid
}

export function unlinkMessage(messageId: string | undefined) {
    if (!messageId) return
    messageEventMap.delete(messageId)
}

export function unlinkEvent(eventUuid: string | undefined) {
    if (!eventUuid) return

    for (const [messageId, link] of messageEventMap.entries()) {
        if (link.eventUuid === eventUuid) {
            messageEventMap.delete(messageId)
        }
    }
}

export function getMessageEventLinkCount() {
    cleanupMessageEventLinks(true)
    return messageEventMap.size
}
