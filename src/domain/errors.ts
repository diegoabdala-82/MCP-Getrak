/**
 * US-006 — Tratamento de erros padronizado.
 *
 * Contrato de erro aprovado (TD-01 / CLAUDE.md Seção 3):
 * { error: { code, message, retryable, request_id } }
 *
 * Nenhum erro bruto da API Core deve chegar ao consumidor sem passar por este
 * contrato — ver `foundation/errors/error-normalizer.ts`.
 */

import { ZodError } from "zod";

/** Códigos de erro padronizados usados pela fundação e reutilizáveis pelas tools. */
export const ErrorCodes = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  UNAUTHORIZED: "UNAUTHORIZED",
  CENTRAL_NOT_AUTHORIZED: "CENTRAL_NOT_AUTHORIZED",
  NOT_FOUND: "NOT_FOUND",
  RATE_LIMITED: "RATE_LIMITED",
  TIMEOUT: "TIMEOUT",
  UPSTREAM_UNAVAILABLE: "UPSTREAM_UNAVAILABLE",
  UPSTREAM_ERROR: "UPSTREAM_ERROR",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes] | (string & {});

export interface ToolError {
  code: ErrorCode;
  message: string;
  retryable: boolean;
  request_id: string;
}

export interface ErrorEnvelope {
  error: ToolError;
}

export interface McpToolErrorParams {
  code: ErrorCode;
  message: string;
  retryable?: boolean;
  /** Status HTTP de origem, quando aplicável — usado internamente, nunca exposto ao consumidor. */
  upstreamStatus?: number;
  cause?: unknown;
}

/**
 * Erro interno padronizado da fundação. Toda tool deve lançar/propagar este tipo
 * (ou deixar que a fundação normalize erros inesperados para ele) antes de a
 * resposta chegar ao envelope de erro do consumidor.
 */
export class McpToolError extends Error {
  readonly code: ErrorCode;
  readonly retryable: boolean;
  readonly upstreamStatus?: number;

  constructor(params: McpToolErrorParams) {
    super(params.message, { cause: params.cause });
    this.name = "McpToolError";
    this.code = params.code;
    this.retryable = params.retryable ?? false;
    this.upstreamStatus = params.upstreamStatus;
  }

  toToolError(requestId: string): ToolError {
    return {
      code: this.code,
      message: this.message,
      retryable: this.retryable,
      request_id: requestId,
    };
  }
}

/**
 * Converte qualquer erro capturado durante a execução de uma tool no contrato
 * padronizado. Erros já normalizados (`McpToolError`) passam adiante; erros de
 * validação de entrada (Zod) viram `VALIDATION_ERROR`; qualquer outro erro
 * inesperado vira `INTERNAL_ERROR` — nunca repassamos a mensagem/stack bruta.
 */
export function toMcpToolError(err: unknown): McpToolError {
  if (err instanceof McpToolError) {
    return err;
  }

  if (err instanceof ZodError) {
    return new McpToolError({
      code: ErrorCodes.VALIDATION_ERROR,
      message: describeZodError(err),
      retryable: false,
      cause: err,
    });
  }

  return new McpToolError({
    code: ErrorCodes.INTERNAL_ERROR,
    message: "Unexpected internal error.",
    retryable: false,
    cause: err,
  });
}

function describeZodError(err: ZodError): string {
  const first = err.issues[0];
  if (!first) {
    return "Invalid input.";
  }
  const path = first.path.join(".") || "(root)";
  return `Invalid input at "${path}": ${first.message}`;
}
