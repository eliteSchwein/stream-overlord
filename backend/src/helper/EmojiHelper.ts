/**
 * Remove Unicode emoji sequences while leaving normal text intact.
 *
 * Covers:
 * - normal pictographic / emoji-presentation characters
 * - variation selectors
 * - skin-tone modifiers
 * - ZWJ sequences (families, professions, etc.)
 * - regional-indicator flags
 * - keycap sequences
 * - subdivision/tag flags
 */
export function stripUnicodeEmojis(text: string): string {
    if (!text) return text;

    const emojiBase = String.raw`(?:\p{Extended_Pictographic}|\p{Emoji_Presentation})`;
    const emojiPart = String.raw`${emojiBase}[\uFE0E\uFE0F]?\p{Emoji_Modifier}?`;
    const emojiSequence = new RegExp(
        String.raw`${emojiPart}(?:\u200D${emojiPart})*`,
        "gu",
    );

    return text
        // Keycaps: #️⃣, *️⃣, 0️⃣ ... 9️⃣
        .replace(/[#*0-9]\uFE0F?\u20E3/gu, "")
        // Country flags. Remove the entire run so malformed/odd runs don't leak.
        .replace(/\p{Regional_Indicator}+/gu, "")
        // Pictographic, emoji-presentation and complete ZWJ/modifier sequences.
        .replace(emojiSequence, "")
        // Tag characters used by subdivision flags, e.g. England/Scotland/Wales.
        .replace(/[\u{E0020}-\u{E007F}]/gu, "")
        // Defensive cleanup for sequence components left by malformed input.
        .replace(/[\p{Emoji_Modifier}\u200D\uFE0E\uFE0F]/gu, "");
}

export function stripUnicodeEmojisAndNormalizeWhitespace(text: string): string {
    return stripUnicodeEmojis(text)
        .replace(/[ \t]{2,}/g, " ")
        .trim();
}
