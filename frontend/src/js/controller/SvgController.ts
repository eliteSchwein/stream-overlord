import BaseController from "./BaseController";
import {Websocket} from "websocket-ts";

export default class SvgController extends BaseController {
    private themeElements = []

    async postConnect() {
        const request = await fetch(this.element.dataset.src)

        if(request.status !== 200) return

        const content = new DOMParser().parseFromString(await request.text(), 'text/html')
        const parsedContent = content.querySelector('svg') as SVGElement

        if(!parsedContent) return

        this.element.innerHTML = parsedContent.innerHTML

        this.element.setAttribute('viewBox', parsedContent.getAttribute('viewBox'))

        const svgElements = this.element.querySelectorAll('*')

        svgElements.forEach((element) => {
            const computedFill = getComputedStyle(element).fill;
            if (computedFill === "rgb(255, 165, 165)") { // Check for #ffa5a5 in RGB
                this.themeElements.push(element)
            }
        })

        // @ts-ignore
        const svgStyleElement = this.element.querySelector('style') as SVGStyleElement

        let styleContent = svgStyleElement.innerHTML

        styleContent = styleContent.replace(/fill:\s*#ffa5a5/g, 'transition: all 1s ease-in-out')

        svgStyleElement.innerHTML = styleContent
    }

    async handleTheme(websocket: Websocket, data: any) {
        this.themeElements.forEach((themeElement) => {
            themeElement.style.fill = data.color
        })
    }
}