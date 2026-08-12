import { describe, expect, it, vi } from "vitest";
import { ErrorCodes, McpToolError } from "../../src/domain/errors.js";
import {
  isRetryableError,
  normalizeUpstreamHttpError,
  normalizeUpstreamTransportError,
  UpstreamTimeoutError,
} from "../../src/foundation/errors/error-normalizer.js";
import { computeBackoffWithJitter, READ_RETRY_OPTIONS, withRetry } from "../../src/foundation/errors/retry.js";
import { fetchWithTimeout } from "../../src/foundation/http/http-client.js";

describe("US-006 — tratamento de erros padronizado", () => {
  it("normaliza um erro 404 da API Core no contrato de erro estável", () => {
    const error = normalizeUpstreamHttpError({ status: 404, domainCode: "VEHICLE_NOT_FOUND" });
    expect(error).toBeInstanceOf(McpToolError);
    expect(error.code).toBe("VEHICLE_NOT_FOUND");
    expect(error.retryable).toBe(false);
  });

  it("marca 429/502/503/504 como erros transitórios elegíveis a retry", () => {
    for (const status of [429, 502, 503, 504]) {
      const error = normalizeUpstreamHttpError({ status });
      expect(error.retryable).toBe(true);
    }
  });

  it("marca 401/403 como não retryable", () => {
    expect(normalizeUpstreamHttpError({ status: 401 }).retryable).toBe(false);
    expect(normalizeUpstreamHttpError({ status: 403 }).code).toBe(ErrorCodes.UNAUTHORIZED);
  });

  it("interrompe e normaliza timeout quando o limite é excedido", async () => {
    const slowFetch = vi.fn(
      () =>
        new Promise((_resolve, reject) => {
          setTimeout(() => reject(Object.assign(new Error("aborted"), { name: "AbortError" })), 5);
        }),
    ) as unknown as typeof fetch;

    await expect(
      fetchWithTimeout({ method: "GET", url: "https://api.getrak.com/x", timeoutMs: 1 }, slowFetch),
    ).rejects.toBeInstanceOf(UpstreamTimeoutError);
  });

  it("classifica timeout como erro retryable padronizado", () => {
    const timeoutError = new UpstreamTimeoutError(5000);
    const normalized = normalizeUpstreamTransportError(timeoutError);
    expect(normalized.code).toBe(ErrorCodes.TIMEOUT);
    expect(normalized.retryable).toBe(true);
    expect(isRetryableError(normalized)).toBe(true);
  });

  it("retry de leitura tenta no máximo 2 vezes adicionais (3 tentativas totais) em erro transitório", async () => {
    let attempts = 0;
    const fn = vi.fn(async () => {
      attempts += 1;
      throw normalizeUpstreamHttpError({ status: 503 });
    });

    await expect(
      withRetry(fn, isRetryableError, READ_RETRY_OPTIONS, { sleep: async () => {} }),
    ).rejects.toMatchObject({ code: ErrorCodes.UPSTREAM_UNAVAILABLE });
    expect(attempts).toBe(3);
  });

  it("não faz retry em erro não transitório", async () => {
    const fn = vi.fn(async () => {
      throw normalizeUpstreamHttpError({ status: 404 });
    });

    await expect(withRetry(fn, isRetryableError, READ_RETRY_OPTIONS)).rejects.toMatchObject({
      code: ErrorCodes.NOT_FOUND,
    });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retorna com sucesso assim que uma tentativa subsequente funciona", async () => {
    let calls = 0;
    const fn = vi.fn(async () => {
      calls += 1;
      if (calls < 2) throw normalizeUpstreamHttpError({ status: 502 });
      return "ok";
    });

    const result = await withRetry(fn, isRetryableError, READ_RETRY_OPTIONS, { sleep: async () => {} });
    expect(result).toBe("ok");
    expect(calls).toBe(2);
  });

  it("backoff com jitter nunca excede o teto exponencial e nunca é negativo", () => {
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const delay = computeBackoffWithJitter(attempt, 200, 2000);
      expect(delay).toBeGreaterThanOrEqual(0);
      expect(delay).toBeLessThanOrEqual(Math.min(200 * 2 ** (attempt - 1), 2000));
    }
  });
});
