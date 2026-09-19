type GiftIdentity = {
    gifterId?: string | null;
    gifterDisplayName?: string | null;
};

type PendingSubGift = {
    resolve: (isCommunityGift: boolean) => void;
    timer: ReturnType<typeof setTimeout>;
};

type ReservedCommunityGift = {
    count: number;
    timer: ReturnType<typeof setTimeout>;
};

const pendingSubGifts = new Map<string, PendingSubGift[]>();
const reservedCommunitySubGifts = new Map<string, ReservedCommunityGift>();

// Twitch does not guarantee whether the per-recipient SubGift events or the
// CommunitySub summary arrives first. Keep individual gifts around briefly so
// both event orderings can be correlated without firing duplicate macros.
const COMMUNITY_GIFT_GRACE_MS = 650;
const COMMUNITY_GIFT_RESERVATION_MS = 5000;

function getGifterKey(event: GiftIdentity): string {
    if (event.gifterId) {
        return `id:${event.gifterId}`;
    }

    if (event.gifterDisplayName) {
        return `name:${event.gifterDisplayName.toLowerCase()}`;
    }

    return 'anonymous';
}

function consumeReservedCommunitySubGift(key: string): boolean {
    const reserved = reservedCommunitySubGifts.get(key);

    if (!reserved || reserved.count <= 0) {
        return false;
    }

    reserved.count -= 1;

    if (reserved.count <= 0) {
        clearTimeout(reserved.timer);
        reservedCommunitySubGifts.delete(key);
    }

    return true;
}

function reserveCommunitySubGifts(key: string, count: number) {
    if (count <= 0) return;

    const current = reservedCommunitySubGifts.get(key);

    if (current) {
        clearTimeout(current.timer);
        current.count += count;
        current.timer = setTimeout(() => {
            reservedCommunitySubGifts.delete(key);
        }, COMMUNITY_GIFT_RESERVATION_MS);
        return;
    }

    const reservation: ReservedCommunityGift = {
        count,
        timer: setTimeout(() => {
            reservedCommunitySubGifts.delete(key);
        }, COMMUNITY_GIFT_RESERVATION_MS),
    };

    reservedCommunitySubGifts.set(key, reservation);
}

/**
 * Briefly buffer a raw individual SubGift before it enters the event
 * lifecycle, to determine whether it belongs to a CommunitySub gift bomb.
 *
 * Returns true when the individual event must be suppressed because the
 * matching CommunitySub event owns it. Returns false for a genuine one-off
 * gift and the caller may trigger the normal SubGift event.
 */
export function waitForCommunitySubGift(event: GiftIdentity): Promise<boolean> {
    const key = getGifterKey(event);

    // Handles the CommunitySub-first ordering.
    if (consumeReservedCommunitySubGift(key)) {
        return Promise.resolve(true);
    }

    return new Promise<boolean>(resolve => {
        const pending: PendingSubGift = {
            resolve,
            timer: undefined as any,
        };

        pending.timer = setTimeout(() => {
            const gifts = pendingSubGifts.get(key) ?? [];
            const index = gifts.indexOf(pending);

            if (index !== -1) {
                gifts.splice(index, 1);
            }

            if (gifts.length === 0) {
                pendingSubGifts.delete(key);
            } else {
                pendingSubGifts.set(key, gifts);
            }

            resolve(false);
        }, COMMUNITY_GIFT_GRACE_MS);

        const gifts = pendingSubGifts.get(key) ?? [];
        gifts.push(pending);
        pendingSubGifts.set(key, gifts);
    });
}

/**
 * Register a CommunitySub summary and claim its per-recipient SubGift events.
 * Returns how many already-buffered SubGift events were suppressed.
 */
export function registerCommunitySubGift(event: GiftIdentity & { count: number }): number {
    // A count of one is treated as a regular single gift. This keeps the two
    // configured events mutually exclusive as requested.
    if (event.count <= 1) {
        return 0;
    }

    const key = getGifterKey(event);
    const pending = pendingSubGifts.get(key) ?? [];
    const matchedCount = Math.min(event.count, pending.length);

    for (let index = 0; index < matchedCount; index += 1) {
        const gift = pending.shift();
        if (!gift) break;

        clearTimeout(gift.timer);
        gift.resolve(true);
    }

    if (pending.length === 0) {
        pendingSubGifts.delete(key);
    } else {
        pendingSubGifts.set(key, pending);
    }

    // Handles the CommunitySub-first ordering, or recipient SubGift events
    // that arrive shortly after the summary.
    reserveCommunitySubGifts(key, event.count - matchedCount);

    return matchedCount;
}

export function clearCommunitySubGiftState() {
    for (const gifts of pendingSubGifts.values()) {
        for (const gift of gifts) {
            clearTimeout(gift.timer);
            gift.resolve(false);
        }
    }

    for (const reserved of reservedCommunitySubGifts.values()) {
        clearTimeout(reserved.timer);
    }

    pendingSubGifts.clear();
    reservedCommunitySubGifts.clear();
}
