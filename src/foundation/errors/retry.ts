/**
 * US-006 — Tratamento de erros padronizado (política de retry, TD-03).
 *
 * Retry — read: até 2 tentativas adicionais, apenas em erros transitórios
 * (HTTP 429/502/503/504, timeout de conexão/rede), com backoff exponencial +
 * jitter. Retry — write: 0 por padrão (fora da V1, que é read-only).
 */

export interface RetryOptions {
  /** Número de tentativas adicionais após a primeira (TD-03: 2 para leitura). */
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

export const READ_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 2,
  baseDelayMs: 200,
  maxDelayMs: 2000,
};

/** 0 tentativas automáticas por padrão para escrita — fora da V1, já pré-definido (CLAUDE.md Seção 4). */
export const WRITE_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 0,
  baseDelayMs: 0,
  maxDelayMs: 0,
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Backoff exponencial com jitter completo: delay uniformemente aleatório em [0, cap]. */
export function computeBackoffWithJitter(attempt: number, baseDelayMs: number, maxDelayMs: number): number {
  const cap = Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs);
  return Math.random() * cap;
}

export interface WithRetryDeps {
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
}

/**
 * Executa `fn`, reexecutando em caso de falha elegível (`isRetryable`), até
 * `options.maxRetries` tentativas adicionais, com backoff exponencial + jitter.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  isRetryable: (err: unknown) => boolean,
  options: RetryOptions,
  deps: WithRetryDeps = {},
): Promise<T> {
  const doSleep = deps.sleep ?? sleep;
  let attempt = 0;

  for (;;) {
    try {
      return await fn();
    } catch (err) {
      attempt += 1;
      if (attempt > options.maxRetries || !isRetryable(err)) {
        throw err;
      }
      const delay = computeBackoffWithJitter(attempt, options.baseDelayMs, options.maxDelayMs);
      await doSleep(delay);
    }
  }
}
