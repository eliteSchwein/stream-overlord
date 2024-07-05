import BaseCommand from "./BaseCommand";
import {BotCommandContext} from "@twurple/easy-bot";
import * as systeminformation from "systeminformation"

export default class HardwareCommand extends BaseCommand{
    command = 'hardware'

    async handle(params: any, context: BotCommandContext) {
        const cpuData = await systeminformation.cpu()
        const cpuTemp = await systeminformation.cpuTemperature()
        const cpuClock = await systeminformation.cpuCurrentSpeed()

        await context.say(`CPU: ${cpuData.manufacturer} ${cpuData.brand} @ ${cpuClock.avg} GHz`)
        await context.say(`Temp: ${cpuTemp.main}°C`)

        const gpuData = await systeminformation.graphics()
        console.log(gpuData)
    }
}