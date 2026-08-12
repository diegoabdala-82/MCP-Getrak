/**
 * Cliente transversal de chamadas à Getrak API Core, combinando US-001
 * (autenticação por ambiente/esquema), US-006 (timeout, retry, normalização
 * de erro). Tools de domínio (Fase 2+) devem chamar `ApiCoreClient.get`
 * em vez de montar autenticação/retry/timeout por conta própria — isso é
 * o que evita duplicar a fundação dentro de cada tool.
 */

import type { Environment } from "../../config/environment.js";
import { McpToolError, toMcpToolError } from "../../domain/errors.js";
import type { AuthManager } from "../auth/auth-manager.js";
import { TokenRequestFailedError } from "../auth/oauth2-client.js";
import type { AuthScheme } from "../auth/types.js";
import {
  isRetryableError,
  normalizeUpstreamHttpError,
  normalizeUpstreamTransportError,
  UpstreamNetworkError,
  UpstreamTimeoutError,
} from "../errors/error-normalizer.js";
import { READ_RETRY_OPTIONS, withRetry } from "../errors/retry.js";
import {
  fetchWithTimeout,
  SIMPLE_CALL_TIMEOUT_MS,
  type FetchLike,
} from "./http-client.js";

/**
 * Normaliza uma falha na obtenção do token de acesso (`AuthManager.getAccessToken`).
 * Distinta da normalização de falha na chamada ao endpoint em si: um erro de
 * configuração (ex.: credencial técnica ausente) nunca deve ser reportado ao
 * consumidor como "API Core indisponível" — são causas e ações corretivas
 * completamente diferentes (config do servidor MCP vs. problema de rede/da
 * API Core).
 */
function normalizeAuthError(err: unknown): McpToolError {
  if (err instanceof UpstreamTimeoutError || err instanceof UpstreamNetworkError) {
    return normalizeUpstreamTransportError(err);
  }
  if (err instanceof TokenRequestFailedError) {
    // Sem domainCode: 401/403 já mapeiam para UNAUTHORIZED (credencial
    // rejeitada) e 429/502/503/504 para o transiente correto; qualquer outro
    // status cai em UPSTREAM_ERROR genérico — não presumir "não autorizado"
    // para, por exemplo, um 400 (grant_type malformado).
    return normalizeUpstreamHttpError({ status: err.status });
  }
  // Ex.: MissingSecretError — problema de configuração do servidor MCP, não
  // da API Core; não é retryable e não deve ser confundido com falha de rede.
  return toMcpToolError(err);
}

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
        let token: string;
        try {
          token = await this.authManager.getAccessToken({
            environment: params.environment,
            central: params.central,
            authScheme: params.authScheme,
          });
        } catch (err) {
          throw normalizeAuthError(err);
        }

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
      // Neste ponto todo erro esperado (auth, timeout, HTTP de erro) já foi
      // normalizado dentro do closure acima — qualquer coisa que escape até
      // aqui é inesperada e vira INTERNAL_ERROR, nunca um "erro de rede"
      // presumido (que induziria retry indevido do lado do consumidor).
      throw toMcpToolError(err);
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
