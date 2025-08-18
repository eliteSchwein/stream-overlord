// styles
import "./style/global.css"
import "./style/fonts.css"
import "./style/animation.css"
import "./style/background.css"
import "./style/badge.css"
import "./style/alert.css"
import "./style/timer.css"
import "./style/announce.css"
import "./style/toggle.css"
import "./style/shoutout.css"
import "./style/music.css"
import "bootstrap/dist/css/bootstrap.css"
import "@mdi/font/css/materialdesignicons.css"

// javascript
import WebsocketClient from "./js/client/WebsocketClient";
import {Application} from "@hotwired/stimulus";
import BackgroundController from "./js/controller/BackgroundController";
import BadgeController from "./js/controller/BadgeController";
import fetchConfig from "./js/helper/ConfigHelper";
import * as packageConfig from '../../package.json'
import {loadFull} from "tsparticles";
import {tsParticles} from "@tsparticles/engine"
import AlertController from "./js/controller/AlertController";
import TimerController from "./js/controller/TimerController";
import AnnounceController from "./js/controller/AnnounceController";
import EffectController from "./js/controller/EffectController";
import SvgController from "./js/controller/SvgController";
import ToggleController from "./js/controller/ToggleController";
import ShoutoutController from "./js/controller/ShoutoutController";
import InfoController from "./js/controller/InfoController";
import SourceBackgroundController from "./js/controller/SourceBackgroundController";
import TauonmbController from "./js/controller/TauonmbController";
import VisibleController from "./js/controller/VisibleController";

// variables
let websocketClient: WebsocketClient

void init()

async function init(){
    console.log(`Starting ${packageConfig.name} ${packageConfig.version} frontend...`)
    await fetchConfig()

    await loadFull(tsParticles);

    websocketClient = new WebsocketClient()
    await websocketClient.connect()

    const stimulus = Application.start()
    stimulus.register('background', BackgroundController)
    stimulus.register('badge', BadgeController)
    stimulus.register('alert', AlertController)
    stimulus.register('timer', TimerController)
    stimulus.register('announce', AnnounceController)
    stimulus.register('effect', EffectController)
    stimulus.register('svg', SvgController)
    stimulus.register('toggle', ToggleController)
    stimulus.register('shoutout', ShoutoutController)
    stimulus.register('info', InfoController)
    stimulus.register('source_background', SourceBackgroundController)
    stimulus.register('tauonmb', TauonmbController)
    stimulus.register('visible', VisibleController)
}

export function getWebsocketClient() {
    return websocketClient
}