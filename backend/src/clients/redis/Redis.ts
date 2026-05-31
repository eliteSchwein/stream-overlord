import { createClient, RedisClientType } from 'redis';
import {getConfig} from "../../helper/ConfigHelper";
import {logRegular, logSuccess, logWarn} from "../../helper/LogHelper";

export default class Redis {
    protected redisClient: RedisClientType | undefined

    public async connect() {
        await this.disconnect()

        logRegular(`connect redis`)

        const config = getConfig(/redis/g)[0]

        if(!config) return

        try {
            this.redisClient = createClient({
                url: `redis://${config.host}:${config.port}`,
                password: config.password
            })

            await this.redisClient.connect()
        } catch (error) {
            logWarn('redis client failed:')
            logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)))
        }

        logSuccess(`connected to redis`)
    }

    public async disconnect() {
        if (!this.redisClient) return

        logRegular(`disconnect redis`)

        await this.redisClient.quit()

        logSuccess(`disconnected from redis`)
    }

    public getVariable(key: string) {
        return this.redisClient?.get(key)
    }

    public async setVariable(key: string, value: string) {
        await this.redisClient?.set(key, value)
    }
}