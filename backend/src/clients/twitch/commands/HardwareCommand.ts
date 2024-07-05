import BaseCommand from "./BaseCommand";
import {BotCommandContext} from "@twurple/easy-bot";
import * as systeminformation from "systeminformation"

export default class HardwareCommand extends BaseCommand{
    command = 'hardware'

    async handle(params: any, context: BotCommandContext) {
        const cpuData = await systeminformation.cpu()
        const cpuTemp = await systeminformation.cpuTemperature()
        const cpuClock = await systeminformation.cpuCurrentSpeed()

        void context.say(`CPU: ${cpuData.manufacturer} ${cpuData.brand} @ ${cpuClock.avg}GHz`)
        void context.say(`Temp: ${cpuTemp.main}°C`)

        const gpuData = await systeminformation.graphics()

        for(const index in gpuData.controllers) {
            const gpu = gpuData.controllers[index]

            const displayIndex = parseInt(index) + 1

            if(gpu.name) {
                void context.say(`GPU ${displayIndex}: ${gpu.model} @ ${gpu.clockCore}MHz`)
                void context.say(`Temp: ${gpu.temperatureGpu}°C`)
                if(gpu.utilizationGpu) {
                    void context.say(`Usage: ${gpu.utilizationGpu}%`)
                }
                continue
            }

            void context.say(`GPU ${displayIndex}: ${gpu.vendor} ${gpu.model}`)
        }
    }
}