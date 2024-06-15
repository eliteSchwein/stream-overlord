import WebsocketClient from "./js/client/WebsocketClient";
import {Application} from "@hotwired/stimulus";
import BackgroundController from "./js/controller/BackgroundController";
import fetchConfig from "./js/helper/ConfigHelper";
import * as packageConfig from '../../package.json'

import "./style/global.css"
import "./style/background.css"

let websocketClient: WebsocketClient

void init()

async function init(){
    console.log(`Starting ${packageConfig.name} ${packageConfig.version} frontend...`)
    await fetchConfig()

    websocketClient = new WebsocketClient()

    const stimulus = Application.start()
    stimulus.register('background', BackgroundController)

    websocketClient.connect()
}

export function getWebsocketClient() {
    return websocketClient
}