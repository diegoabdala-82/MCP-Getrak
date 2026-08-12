/**
 * US-001 — Autenticação técnica por ambiente / TD-04 — Estratégia de cache.
 * Implementação de produção do `TokenCache` sobre Amazon ElastiCache for
 * Redis. Compartilhado entre instâncias do MCP; TTL aplicado nativamente
 * pelo Redis (SET ... EX). Tokens nunca aparecem em log — este módulo não
 * loga nenhum valor de token, apenas erros de conectividade.
 */

import type { CachedToken, TokenCache } from "./token-cache.js";

/**
 * Subconjunto mínimo do cliente Redis (`ioredis`) necessário aqui — mantido
 * como interface própria para não acoplar todo o resto da fundação ao tipo
 * concreto do cliente e para permitir testes com um fake simples.
 */
export interface RedisLikeClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: "EX", ttlSeconds: number): Promise<unknown>;
  del(key: string): Promise<unknown>;
}

export class RedisTokenCache implements TokenCache {
  constructor(private readonly client: RedisLikeClient) {}

  async get(namespace: string): Promise<CachedToken | null> {
    const raw = await this.client.get(namespace);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as CachedToken;
  }

  async set(namespace: string, token: CachedToken, ttlSeconds: number): Promise<void> {
    if (ttlSeconds <= 0) {
      // Token já efetivamente expirado (considerando a margem de segurança) — não vale a pena cachear.
      return;
    }
    await this.client.set(namespace, JSON.stringify(token), "EX", ttlSeconds);
  }

  async delete(namespace: string): Promise<void> {
    await this.client.del(namespace);
  }
}
