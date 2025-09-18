const visibleElements = {}

export function isElementVisible(id: string) {
    return visibleElements[id];
}

export function toggleElementVisiblity(id: string, state: boolean) {
    visibleElements[id] = state;
}

export function getAllVisibleElements() {
    return visibleElements;
}