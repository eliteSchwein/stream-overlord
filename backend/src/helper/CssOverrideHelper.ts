export type CssOverrideAction = "set" | "append" | "reset";

export type CssOverride = {
    selector: string;
    css: string;
};

// Active overrides are kept so overlays that (re)connect receive the current
// state, the same way visible elements are replayed.
const overrides = new Map<string, CssOverride>();

export function applyCssOverride(
    action: CssOverrideAction,
    selector: string | null,
    css: string,
) {
    if (action === "reset") {
        if (selector) {
            overrides.delete(selector);
        } else {
            overrides.clear();
        }

        return;
    }

    if (!selector) return;

    const previous = overrides.get(selector);

    // re-insert so replay keeps the order the overrides were applied in
    overrides.delete(selector);
    overrides.set(selector, {
        selector,
        css: action === "append" && previous
            ? `${previous.css};${css}`
            : css,
    });
}

export function getCssOverrides(): CssOverride[] {
    return [...overrides.values()];
}
