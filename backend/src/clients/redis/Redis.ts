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
            logSuccess(`connected to redis`)
        } catch (error) {
            this.redisClient = undefined
            logWarn('redis client failed:')
            logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)))
        }
    }

    public async disconnect() {
        if (!this.redisClient) return

        logRegular(`disconnect redis`)

        try {
            await this.redisClient.quit()
            logSuccess(`disconnected from redis`)
        } catch (error) {
            logWarn('redis disconnect failed:')
            logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)))
        } finally {
            this.redisClient = undefined
        }
    }

    public isReady() {
        return !!this.redisClient?.isReady
    }

    public getVariable(key: string) {
        if (!this.redisClient?.isReady) return undefined

        return this.redisClient.get(key)
    }

    public async setVariable(key: string, value: string) {
        if (!this.redisClient?.isReady) return

        await this.redisClient.set(key, value)
    }

    public async deleteVariable(key: string) {
        if (!this.redisClient?.isReady) return

        await this.redisClient.del(key)
    }
}

export const redis = new Redis()
