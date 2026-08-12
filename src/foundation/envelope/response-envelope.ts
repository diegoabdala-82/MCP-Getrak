/**
 * US-003 — Normalização de respostas das tools.
 *
 * Envelope de sucesso aprovado (TD-01 / CLAUDE.md Seção 3):
 * { data, meta: { request_id, central, partial }, warnings: [] }
 *
 * A resposta bruta de um endpoint da API Core nunca é o contrato de uma tool —
 * cada tool constrói seu próprio `data`; este módulo só garante o envelope
 * externo estável (meta/warnings) e a normalização de nulos/ausentes.
 */

import type { ErrorEnvelope, McpToolError } from "../../domain/errors.js";

export interface SuccessMeta {
  request_id: string;
  /** `null` para infraestrutura transversal sem central associada (ex.: descoberta de tools). */
  central: string | null;
  partial: boolean;
}

export interface SuccessEnvelope<TData> {
  data: TData;
  meta: SuccessMeta;
  warnings: string[];
}

export interface BuildSuccessEnvelopeParams<TData> {
  data: TData;
  requestId: string;
  central: string | null;
  /** `true` em tools compostas quando parte das fontes estiver indisponível (ver US-029). */
  partial?: boolean;
  warnings?: string[];
}

export function buildSuccessEnvelope<TData>(
  params: BuildSuccessEnvelopeParams<TData>,
): SuccessEnvelope<TData> {
  return {
    data: params.data,
    meta: {
      request_id: params.requestId,
      central: params.central,
      partial: params.partial ?? false,
    },
    warnings: params.warnings ?? [],
  };
}

export function buildErrorEnvelope(error: McpToolError, requestId: string): ErrorEnvelope {
  return { error: error.toToolError(requestId) };
}

/**
 * Normaliza valor nulo/ausente do endpoint de origem para uma representação
 * consistente (`null`), conforme critério de aceite de US-003 — nunca deixa
 * `undefined` vazar para o contrato de uma tool.
 */
export function normalizeNullable<T>(value: T | null | undefined): T | null {
  return value === undefined ? null : value;
}

/**
 * Aplica `normalizeNullable` recursivamente a todas as propriedades de um
 * objeto plano (um nível), útil ao montar o `data` de uma tool a partir de um
 * payload heterogêneo da API Core.
 */
export function normalizeNullableFields<T extends Record<string, unknown>>(
  obj: T,
): { [K in keyof T]: T[K] extends undefined ? null : T[K] } {
  const result = {} as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    result[key] = normalizeNullable(obj[key]);
  }
  return result as { [K in keyof T]: T[K] extends undefined ? null : T[K] };
}
