/**
 * Fábrica do cliente Redis real (ioredis) usado por `RedisTokenCache` em
 * produção/homologação. Mantido isolado do restante da fundação para que
 * `RedisTokenCache` só dependa da interface `RedisLikeClient`, nunca do
 * pacote `ioredis` diretamente.
 */

import { Redis } from "ioredis";
import type { RedisLikeClient } from "./redis-token-cache.js";

export interface CreateRedisClientParams {
  url: string;
}

export function createRedisClient(params: CreateRedisClientParams): RedisLikeClient {
  return new Redis(params.url);
}
