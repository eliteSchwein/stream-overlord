import BaseController from "./BaseController";
import ParticleHelper from "../helper/ParticleHelper";
import {Websocket} from "websocket-ts";

export default class AlertController extends BaseController{
    static targets = ['icon', 'content']

    declare readonly iconTarget: HTMLElement
    declare readonly contentTarget: HTMLDivElement

    protected particle: ParticleHelper

    async postConnect() {
        this.particle = new ParticleHelper()
        await this.particle.loadParticle(this.element)
    }

    async handleTheme(websocket: Websocket, data: any) {
        await this.particle.loadThemeColor(data.color)
        this.element.style.boxShadow = `0 0 7px 0 ${data.color}`
        this.iconTarget.style.color = data.color
    }
}