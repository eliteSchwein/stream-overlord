import BaseController from "./BaseController";

export default class MarqueeController extends BaseController {
    protected currentContent = ''

    async postConnect() {
        const observer = new MutationObserver((mutationsList, observer) => {
            if(this.element.innerHTML === this.currentContent) return
            this.currentContent = this.element.innerHTML

            this.addMarquee()
        })

        observer.observe(this.element, {
            childList: true,
            subtree: true,
            characterData: true
        })

        window.addEventListener("resize", (event) => {
            this.addMarquee()
        })
    }

    private addMarquee() {
        const visibleWidth = this.element.parentElement.clientWidth
        const fullWidth = Math.ceil(this.element.getBoundingClientRect().width)
        const parentElement = this.element.parentElement as HTMLDivElement;


        if (fullWidth > visibleWidth) {
            if(!parentElement.classList.contains('marquee')) {
                parentElement.classList.add('marquee');
            }
        } else {
            if(parentElement.classList.contains('marquee')) {
                parentElement.classList.remove('marquee');
            }
        }
    }
}
