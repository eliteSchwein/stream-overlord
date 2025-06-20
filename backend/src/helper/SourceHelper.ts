import getGameInfo from "./GameHelper";
import {getSourceFilters} from "../clients/website/WebsiteClient";
import {logDebug} from "./LogHelper";

let currentSourceFilters = []

export async function updateSourceFilters() {
    logDebug("update source filters")
    const gameInfo = getGameInfo()
    currentSourceFilters = await getSourceFilters(gameInfo.data.game_id)

    console.log(currentSourceFilters)
}