export default class AlertBoxHelper {
    protected element: HTMLElement

    public constructor(element: HTMLElement) {
        this.element = element

        this.hide()
    }

    public hide() {
        this.addDynamicClass()

        this.element.style.width = '0'
        this.element.style.opacity = '0'
    }

    public show() {
        this.addDynamicClass()

        const handleTransitionEnd = (event: TransitionEvent) => {
            // only care about width transition (avoid multiple triggers)
            if (event.propertyName === "width") {
                this.element.classList.remove("dynamic");
                this.element.removeEventListener("transitionend", handleTransitionEnd);
            }
        };

        this.element.addEventListener("transitionend", handleTransitionEnd);

        this.element.style.width = 'calc(100% - 50px)'
        this.element.style.opacity = '1'
    }

    private addDynamicClass() {
        if(this.element.classList.contains('dynamic')) {
            return
        }

        this.element.classList.add('dynamic')
    }
}