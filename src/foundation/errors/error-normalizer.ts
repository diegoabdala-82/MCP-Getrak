/**
 * US-006 — Tratamento de erros padronizado.
 *
 * Normaliza qualquer falha de chamada à API Core (HTTP de erro, timeout,
 * falha de rede) no contrato de erro estável do MCP. Nenhum erro bruto da
 * API Core deve ser repassado ao consumidor.
 */

import { ErrorCodes, McpToolError } from "../../domain/errors.js";

/** HTTP statuses tratados como transitórios — elegíveis a retry (TD-03). */
export const TRANSIENT_HTTP_STATUS_CODES = [429, 502, 503, 504] as const;

export class UpstreamTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Upstream request timed out after ${timeoutMs}ms.`);
    this.name = "UpstreamTimeoutError";
  }
}

export class UpstreamNetworkError extends Error {
  constructor(cause: unknown) {
    super("Upstream network error.");
    this.name = "UpstreamNetworkError";
    this.cause = cause;
  }
}

export interface NormalizeUpstreamHttpErrorParams {
  status: number;
  /** Código de erro específico do domínio, quando a tool souber mapear (ex.: VEHICLE_NOT_FOUND). */
  domainCode?: string;
  message?: string;
}

/** Normaliza uma resposta HTTP de erro da API Core. */
export function normalizeUpstreamHttpError(params: NormalizeUpstreamHttpErrorParams): McpToolError {
  const { status, domainCode, message } = params;

  if (status === 404) {
    return new McpToolError({
      code: domainCode ?? ErrorCodes.NOT_FOUND,
      message: message ?? "Resource not found.",
      retryable: false,
      upstreamStatus: status,
    });
  }

  if (status === 401 || status === 403) {
    return new McpToolError({
      code: ErrorCodes.UNAUTHORIZED,
      message: "Not authorized to access this resource.",
      retryable: false,
      upstreamStatus: status,
    });
  }

  if (status === 429) {
    return new McpToolError({
      code: ErrorCodes.RATE_LIMITED,
      message: "Rate limit exceeded upstream.",
      retryable: true,
      upstreamStatus: status,
    });
  }

  if ((TRANSIENT_HTTP_STATUS_CODES as readonly number[]).includes(status)) {
    return new McpToolError({
      code: ErrorCodes.UPSTREAM_UNAVAILABLE,
      message: "Upstream service temporarily unavailable.",
      retryable: true,
      upstreamStatus: status,
    });
  }

  return new McpToolError({
    code: domainCode ?? ErrorCodes.UPSTREAM_ERROR,
    message: message ?? "Unexpected upstream error.",
    retryable: false,
    upstreamStatus: status,
  });
}

/** Normaliza falhas de timeout/rede (sem status HTTP) — sempre transitórias. */
export function normalizeUpstreamTransportError(err: unknown): McpToolError {
  if (err instanceof UpstreamTimeoutError) {
    return new McpToolError({
      code: ErrorCodes.TIMEOUT,
      message: err.message,
      retryable: true,
      cause: err,
    });
  }

  return new McpToolError({
    code: ErrorCodes.UPSTREAM_UNAVAILABLE,
    message: "Upstream connection/network error.",
    retryable: true,
    cause: err,
  });
}

/** Determina se um erro (já normalizado ou não) é elegível a retry automático de leitura. */
export function isRetryableError(err: unknown): boolean {
  if (err instanceof McpToolError) {
    return err.retryable;
  }
  return err instanceof UpstreamTimeoutError || err instanceof UpstreamNetworkError;
}
