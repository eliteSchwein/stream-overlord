import {existsSync, mkdirSync, readdirSync, unlinkSync, watch} from "node:fs";
import {logRegular} from "./LogHelper";
import {join} from "node:path";
import {compressAssets, getAssetFile} from "./AssetTuneHelper";
import getWebsocketServer from "../App";
import { getSystemConfigDirectory } from "./ConfigHelper";
import {emitAssetUpdate} from "./AssetManagementHelper";

let files = []
let assetFiles = []

const assetPath = join(getSystemConfigDirectory(), "assets")
const compressedPath = join(getSystemConfigDirectory(), "compressed_assets")

export const imageRegex = /\.(jpe?g|png)$/i
export const videoRegex = /\.(mp4|webm)$/i
export const audioRegex = /\.(mp3)$/i

export function getParsedAssetFiles() {
    return assetFiles
}

export function readAssetFolder() {
    logRegular("reading assets folder")
    files = []
    assetFiles = []

    mkdirSync(assetPath, { recursive: true })

    readdirSync(assetPath).forEach((file) => {
        files.push(`${assetPath}/${file}`)
        assetFiles.push(getAssetFile(file))
    })
}

export function initAssetWatcher() {
    mkdirSync(assetPath, { recursive: true })
    mkdirSync(compressedPath, { recursive: true })

    watch(assetPath, {recursive: true}, async (eventType, filename) => {
        if (!filename) return
        cleanOrphanCompressedFile(filename)

        if(!existsSync(`${assetPath}/${filename}`)) return

        await compressAssets(false, `${assetPath}/${filename}`)

        readAssetFolder()

        getWebsocketServer().send("notify_assets_update", getParsedAssetFiles())
    })
}

function cleanOrphanCompressedFile(file: string) {
    const absAsset = `${assetPath}/${file}`;

    if (existsSync(absAsset)) return

    let compressedFile = file

    if(videoRegex.test(compressedFile)) compressedFile = file.replace(videoRegex, '.webm')
    if(imageRegex.test(compressedFile)) compressedFile = file.replace(imageRegex, '.webp')
    if(audioRegex.test(compressedFile)) compressedFile = file.replace(audioRegex, '.opus')

    if(compressedFile === file) return

    const absCompressed = `${compressedPath}/${compressedFile}`

    if (!existsSync(absCompressed)) return

    logRegular(`delete orphan compressed asset ${compressedFile}`)

    unlinkSync(absCompressed);

    emitAssetUpdate()
}