const pendingCommunitySubGifts = new Map<string, number>();

function getGifterKey(event: {
    gifterId?: string | null;
    gifterDisplayName?: string | null;
}): string {
    if (event.gifterId) {
        return `id:${event.gifterId}`;
    }

    if (event.gifterDisplayName) {
        return `name:${event.gifterDisplayName.toLowerCase()}`;
    }

    return 'anonymous';
}

export function registerCommunitySubGift(event: {
    gifterId?: string | null;
    gifterDisplayName?: string | null;
    count: number;
}) {
    const key = getGifterKey(event);
    const pending = pendingCommunitySubGifts.get(key) ?? 0;

    pendingCommunitySubGifts.set(key, pending + event.count);
}

export function consumeCommunitySubGift(event: {
    gifterId?: string | null;
    gifterDisplayName?: string | null;
}): boolean {
    const key = getGifterKey(event);
    const pending = pendingCommunitySubGifts.get(key) ?? 0;

    if (pending <= 0) {
        return false;
    }

    if (pending === 1) {
        pendingCommunitySubGifts.delete(key);
    } else {
        pendingCommunitySubGifts.set(key, pending - 1);
    }

    return true;
}

export function clearCommunitySubGiftState() {
    pendingCommunitySubGifts.clear();
}
