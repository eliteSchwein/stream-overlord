import WebsocketClient from "./js/client/WebsocketClient";
import {Application} from "@hotwired/stimulus";
import BackgroundController from "./js/controller/BackgroundController";
import BadgeController from "./js/controller/BadgeController";
import fetchConfig from "./js/helper/ConfigHelper";
import * as packageConfig from '../../package.json'
import {loadFull} from "tsparticles";
import {tsParticles} from "@tsparticles/engine"

// styles
import "./style/global.css"
import "./style/fonts.css"
import "./style/animation.css"
import "./style/background.css"
import "./style/badge.css"
import "bootstrap/dist/css/bootstrap.css"

// javascript
let websocketClient: WebsocketClient

void init()

async function init(){
    console.log(`Starting ${packageConfig.name} ${packageConfig.version} frontend...`)
    await fetchConfig()

    await loadFull(tsParticles);

    websocketClient = new WebsocketClient()

    const stimulus = Application.start()
    stimulus.register('background', BackgroundController)
    stimulus.register('badge', BadgeController)

    websocketClient.connect()
}

export function getWebsocketClient() {
    return websocketClient
}