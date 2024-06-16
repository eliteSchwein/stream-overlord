import BaseController from "./BaseController";
import ParticleHelper from "../helper/ParticleHelper";

export default class BadgeController extends BaseController {
    async postConnect() {
        const particle = new ParticleHelper()
        await particle.loadParticle(this.element)
    }
}