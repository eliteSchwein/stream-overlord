// styles
import "./style/global.css"
import "./style/fonts.css"
import "./style/animation.css"
import "./style/background.css"
import "./style/badge.css"
import "./style/alert.css"
import "./style/timer.css"
import "./style/announce.css"
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
}

export function getWebsocketClient() {
    return websocketClient
}