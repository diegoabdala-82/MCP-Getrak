/**
 * Cliente transversal de chamadas à Getrak API Core, combinando US-001
 * (autenticação por ambiente/esquema), US-006 (timeout, retry, normalização
 * de erro). Tools de domínio (Fase 2+) devem chamar `ApiCoreClient.get`
 * em vez de montar autenticação/retry/timeout por conta própria — isso é
 * o que evita duplicar a fundação dentro de cada tool.
 */

import type { Environment } from "../../config/environment.js";
import { McpToolError } from "../../domain/errors.js";
import type { AuthManager } from "../auth/auth-manager.js";
import type { AuthScheme } from "../auth/types.js";
import {
  isRetryableError,
  normalizeUpstreamHttpError,
  normalizeUpstreamTransportError,
} from "../errors/error-normalizer.js";
import { READ_RETRY_OPTIONS, withRetry } from "../errors/retry.js";
import {
  fetchWithTimeout,
  SIMPLE_CALL_TIMEOUT_MS,
  type FetchLike,
} from "./http-client.js";

/**
 * Valor de query simples, ou um array para parâmetros repetidos (ex.:
 * `filters[]=...&filters[]=...`, confirmado no code sample real de
 * GET /v1.0/localization/offline-treatment em reference/openapi.json).
 */
export type ApiCoreQueryValue = string | number | boolean | undefined;

export interface ApiCoreGetParams {
  /** Caminho do endpoint, ex.: "/v0.2/veiculos". */
  path: string;
  query?: Record<string, ApiCoreQueryValue | ApiCoreQueryValue[]>;
  environment: Environment;
  central: string;
  authScheme: AuthScheme;
  timeoutMs?: number;
  /** Código de erro específico do domínio a usar em caso de 404 (ex.: VEHICLE_NOT_FOUND). */
  notFoundCode?: string;
}

export class ApiCoreClient {
  constructor(
    private readonly baseUrl: string,
    private readonly authManager: AuthManager,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  async get<T>(params: ApiCoreGetParams): Promise<T> {
    const url = buildUrl(this.baseUrl, params.path, params.query);
    const timeoutMs = params.timeoutMs ?? SIMPLE_CALL_TIMEOUT_MS;

    return withRetry(
      async () => {
        const token = await this.authManager.getAccessToken({
          environment: params.environment,
          central: params.central,
          authScheme: params.authScheme,
        });

        let response;
        try {
          response = await fetchWithTimeout(
            {
              method: "GET",
              url,
              headers: { Authorization: `Bearer ${token}` },
              timeoutMs,
            },
            this.fetchImpl,
          );
        } catch (err) {
          throw normalizeUpstreamTransportError(err);
        }

        if (!response.ok) {
          throw normalizeUpstreamHttpError({
            status: response.status,
            domainCode: params.notFoundCode,
          });
        }

        return (await response.json()) as T;
      },
      isRetryableError,
      READ_RETRY_OPTIONS,
    ).catch((err) => {
      throw err instanceof McpToolError ? err : normalizeUpstreamTransportError(err);
    });
  }
}

function buildUrl(
  baseUrl: string,
  path: string,
  query?: Record<string, ApiCoreQueryValue | ApiCoreQueryValue[]>,
): string {
  const url = new URL(path, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined) {
        continue;
      }
      if (Array.isArray(value)) {
        for (const item of value) {
          if (item !== undefined) {
            url.searchParams.append(key, String(item));
          }
        }
        continue;
      }
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}
