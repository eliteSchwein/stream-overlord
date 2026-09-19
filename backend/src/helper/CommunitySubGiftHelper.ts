type GiftIdentity = {
    broadcasterId?: string | null;
    broadcasterName?: string | null;
    gifterId?: string | null;
    gifterDisplayName?: string | null;
    plan?: string | null;
};

type PendingSubGift = {
    resolve: (isCommunityGift: boolean) => void;
    timer?: ReturnType<typeof setTimeout>;
};

type PendingGiftBatch = {
    gifts: PendingSubGift[];
    isBurst: boolean;
    fallbackTimer?: ReturnType<typeof setTimeout>;
};

type ReservedCommunityGift = {
    count: number;
    timer: ReturnType<typeof setTimeout>;
};

const pendingSubGiftBatches = new Map<string, PendingGiftBatch>();
const reservedCommunitySubGifts = new Map<string, ReservedCommunityGift>();

// A real single gift should only be delayed very briefly. Community gift bombs
// produce multiple per-recipient SubGift events in a tight burst, so seeing a
// second matching gift upgrades the pending entry into a community candidate.
const SINGLE_GIFT_GRACE_MS = 250;

// Once a burst is detected, keep it outside the normal event/interaction
// lifecycle while waiting for Twitch's CommunitySub summary. This timeout is
// only a safety fallback for a missing summary; it does not delay real singles.
const COMMUNITY_BURST_FALLBACK_MS = 2000;

// Needed only for the opposite ordering where CommunitySub arrives before some
// or all recipient SubGift events. Keep it deliberately short so stale state
// cannot leak into a later, separate gift bomb from the same gifter.
const COMMUNITY_RESERVATION_MS = 1000;

function normalize(value: string | null | undefined): string {
    return String(value ?? '').trim().toLowerCase();
}

function getGifterKey(event: GiftIdentity): string {
    const broadcaster = event.broadcasterId
        ? `broadcaster-id:${event.broadcasterId}`
        : `broadcaster-name:${normalize(event.broadcasterName) || 'unknown'}`;

    const gifter = event.gifterId
        ? `gifter-id:${event.gifterId}`
        : `gifter-name:${normalize(event.gifterDisplayName) || 'anonymous'}`;

    // A gifter can theoretically create adjacent gift batches on different
    // tiers. Including the plan avoids correlating those together.
    const plan = `plan:${normalize(event.plan) || 'unknown'}`;

    return `${broadcaster}|${gifter}|${plan}`;
}

function clearPendingGiftTimer(gift: PendingSubGift) {
    if (!gift.timer) return;
    clearTimeout(gift.timer);
    gift.timer = undefined;
}

function clearBatchFallback(batch: PendingGiftBatch) {
    if (!batch.fallbackTimer) return;
    clearTimeout(batch.fallbackTimer);
    batch.fallbackTimer = undefined;
}

function releaseBatchAsIndividual(key: string, batch: PendingGiftBatch) {
    if (pendingSubGiftBatches.get(key) !== batch) return;

    pendingSubGiftBatches.delete(key);
    clearBatchFallback(batch);

    for (const gift of batch.gifts) {
        clearPendingGiftTimer(gift);
        gift.resolve(false);
    }

    batch.gifts.length = 0;
}

function armBurstFallback(key: string, batch: PendingGiftBatch) {
    clearBatchFallback(batch);
    batch.fallbackTimer = setTimeout(() => {
        releaseBatchAsIndividual(key, batch);
    }, COMMUNITY_BURST_FALLBACK_MS);
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

    // Do not accumulate old reservations. A CommunitySub summary represents
    // one concrete batch, and replacing the reservation prevents stale counts
    // from a previous batch suppressing a later standalone gift.
    const current = reservedCommunitySubGifts.get(key);
    if (current) {
        clearTimeout(current.timer);
        reservedCommunitySubGifts.delete(key);
    }

    const reservation: ReservedCommunityGift = {
        count,
        timer: setTimeout(() => {
            const active = reservedCommunitySubGifts.get(key);
            if (active === reservation) {
                reservedCommunitySubGifts.delete(key);
            }
        }, COMMUNITY_RESERVATION_MS),
    };

    reservedCommunitySubGifts.set(key, reservation);
}

/**
 * Buffer a raw SubGift before it enters BaseEvent's normal lifecycle.
 *
 * A single gift waits only SINGLE_GIFT_GRACE_MS. If another matching gift
 * arrives during that tiny window, the whole burst remains buffered until the
 * CommunitySub summary arrives. This keeps single gifts responsive while gift
 * bombs never create per-recipient interactions/macros first.
 *
 * Returns true when this individual SubGift belongs to a CommunitySub batch
 * and must be suppressed. Returns false when it should proceed normally.
 */
export function waitForCommunitySubGift(event: GiftIdentity): Promise<boolean> {
    const key = getGifterKey(event);

    // CommunitySub-first ordering: consume one recipient from the exact
    // outstanding summary reservation without creating any pending state.
    if (consumeReservedCommunitySubGift(key)) {
        return Promise.resolve(true);
    }

    return new Promise<boolean>(resolve => {
        const gift: PendingSubGift = {resolve};
        const existing = pendingSubGiftBatches.get(key);

        if (!existing) {
            const batch: PendingGiftBatch = {
                gifts: [gift],
                isBurst: false,
            };

            gift.timer = setTimeout(() => {
                // Still a lone gift: let it enter the normal event lifecycle.
                if (pendingSubGiftBatches.get(key) !== batch || batch.isBurst) {
                    return;
                }

                releaseBatchAsIndividual(key, batch);
            }, SINGLE_GIFT_GRACE_MS);

            pendingSubGiftBatches.set(key, batch);
            return;
        }

        // A second matching recipient arriving inside the single-gift grace
        // window identifies this as a burst. Stop the individual timers and
        // hold every recipient until CommunitySub claims the batch.
        if (!existing.isBurst) {
            existing.isBurst = true;

            for (const pendingGift of existing.gifts) {
                clearPendingGiftTimer(pendingGift);
            }

            armBurstFallback(key, existing);
        }

        existing.gifts.push(gift);
    });
}

/**
 * Register a CommunitySub summary and claim the matching buffered recipient
 * SubGift events. Matching pending gifts are resolved and removed immediately;
 * when the full batch was already present there is no leftover buffer state.
 *
 * Returns how many already-buffered SubGift events were suppressed.
 */
export function registerCommunitySubGift(event: GiftIdentity & { count: number }): number {
    if (event.count <= 1) {
        return 0;
    }

    const key = getGifterKey(event);
    const batch = pendingSubGiftBatches.get(key);
    let matchedCount = 0;

    if (batch) {
        matchedCount = Math.min(event.count, batch.gifts.length);

        for (let index = 0; index < matchedCount; index += 1) {
            const gift = batch.gifts.shift();
            if (!gift) break;

            clearPendingGiftTimer(gift);
            gift.resolve(true);
        }

        if (batch.gifts.length === 0) {
            // This is the important purge: once CommunitySub owns the complete
            // buffered batch, remove every bit of pending state immediately.
            clearBatchFallback(batch);
            pendingSubGiftBatches.delete(key);
        } else {
            // More gifts are already waiting than this summary claims. Keep
            // only the remainder for a possible immediately-following batch.
            batch.isBurst = true;
            armBurstFallback(key, batch);
        }
    }

    // CommunitySub can also arrive before all recipient events. Reserve only
    // the exact unmatched remainder, and auto-purge it quickly if Twitch never
    // sends those recipient events.
    const remaining = Math.max(0, event.count - matchedCount);

    if (remaining > 0) {
        reserveCommunitySubGifts(key, remaining);
    } else {
        const reserved = reservedCommunitySubGifts.get(key);
        if (reserved) {
            clearTimeout(reserved.timer);
            reservedCommunitySubGifts.delete(key);
        }
    }

    return matchedCount;
}

export function clearCommunitySubGiftState() {
    for (const batch of pendingSubGiftBatches.values()) {
        clearBatchFallback(batch);

        for (const gift of batch.gifts) {
            clearPendingGiftTimer(gift);
            gift.resolve(false);
        }
    }

    for (const reserved of reservedCommunitySubGifts.values()) {
        clearTimeout(reserved.timer);
    }

    pendingSubGiftBatches.clear();
    reservedCommunitySubGifts.clear();
}
