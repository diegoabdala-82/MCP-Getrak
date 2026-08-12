/**
 * US-001 — Autenticação técnica por ambiente.
 * Cache de tokens (TD-04): compartilhado, em Amazon ElastiCache for Redis.
 * Namespace: `mcp:{environment}:{central}:{auth_scheme}:{credential_id}`.
 * TTL: expiração do token menos 60 segundos de margem de segurança.
 * Tokens nunca aparecem em log, sob nenhuma circunstância.
 *
 * ED-02 (Open — Non-blocking): o comportamento de cache/renovação de token
 * na tool composta `get_vehicle_operational_context` (dois esquemas
 * simultâneos) ainda não foi validado em homologação. A interface abaixo é
 * mantida deliberadamente simples/pluggable para acomodar ajuste posterior
 * sem travar decisões de design como definitivas.
 */

import type { Environment } from "../../config/environment.js";
import type { AuthScheme } from "./types.js";

export interface CachedToken {
  access_token: string;
  /** Epoch millis de expiração já com a margem de segurança aplicada. */
  expires_at: number;
}

export interface TokenCache {
  get(namespace: string): Promise<CachedToken | null>;
  set(namespace: string, token: CachedToken, ttlSeconds: number): Promise<void>;
  delete(namespace: string): Promise<void>;
}

export interface BuildTokenNamespaceParams {
  environment: Environment;
  central: string;
  authScheme: AuthScheme;
  /** Identificador não sensível da credencial (ex.: client_id) — nunca o segredo em si. */
  credentialId: string;
}

/** Constrói o namespace de cache exatamente conforme TD-04. */
export function buildTokenNamespace(params: BuildTokenNamespaceParams): string {
  return `mcp:${params.environment}:${params.central}:${params.authScheme}:${params.credentialId}`;
}

/** Margem de segurança subtraída do TTL do token, conforme TD-04. */
export const TOKEN_EXPIRY_SAFETY_MARGIN_SECONDS = 60;

/**
 * Implementação em memória — usada em testes e como fallback local de
 * desenvolvimento. A implementação de produção (Redis/ElastiCache, TD-04)
 * deve implementar a mesma interface `TokenCache`.
 */
export class InMemoryTokenCache implements TokenCache {
  private readonly store = new Map<string, CachedToken>();

  async get(namespace: string): Promise<CachedToken | null> {
    return this.store.get(namespace) ?? null;
  }

  async set(namespace: string, token: CachedToken): Promise<void> {
    this.store.set(namespace, token);
  }

  async delete(namespace: string): Promise<void> {
    this.store.delete(namespace);
  }
}
