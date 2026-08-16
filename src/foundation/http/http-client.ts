/**
 * US-006 — Tratamento de erros padronizado (timeouts, TD-03).
 * Timeout: 5s para chamada simples, 12s para tool composta.
 *
 * Wrapper fino sobre `fetch` que aplica timeout via AbortController e
 * converte falhas de transporte (abort/timeout, erro de rede) em erros
 * reconhecíveis pela camada de normalização (`error-normalizer.ts`).
 */

import { UpstreamNetworkError, UpstreamTimeoutError } from "../errors/error-normalizer.js";

export const SIMPLE_CALL_TIMEOUT_MS = 5000;
export const COMPOSITE_CALL_TIMEOUT_MS = 12000;

export interface HttpRequestOptions {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  url: string;
  headers?: Record<string, string>;
  /**
   * String (enviado como-está, ex.: form-urlencoded), objeto (serializado
   * como JSON) ou `FormData` (multipart/form-data — ex.: endpoint de token
   * delegado `POST /newkoauth/oauth/token`, confirmado contra chamada real
   * que exige `multipart/form-data`, não `application/x-www-form-urlencoded`,
   * ver `multipart-oauth2-client.ts`). `FormData` é repassado como-está para
   * o `fetch` nativo, que define o `Content-Type`/boundary sozinho — nunca
   * definir `Content-Type` manualmente ao enviar `FormData`.
   */
  body?: string | Record<string, unknown> | FormData;
  timeoutMs?: number;
}

export type FetchLike = typeof fetch;

function serializeBody(body: HttpRequestOptions["body"]): string | FormData | undefined {
  if (body === undefined) {
    return undefined;
  }
  if (typeof body === "string" || body instanceof FormData) {
    return body;
  }
  return JSON.stringify(body);
}

export async function fetchWithTimeout(
  options: HttpRequestOptions,
  fetchImpl: FetchLike = fetch,
): Promise<Response> {
  const timeoutMs = options.timeoutMs ?? SIMPLE_CALL_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetchImpl(options.url, {
      method: options.method,
      headers: options.headers,
      body: serializeBody(options.body),
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new UpstreamTimeoutError(timeoutMs);
    }
    throw new UpstreamNetworkError(err);
  } finally {
    clearTimeout(timer);
  }
}
