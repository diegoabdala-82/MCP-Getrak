/**
 * Helpers genéricos, reutilizáveis por qualquer domínio de tool (não
 * específicos de veículos/localização/equipamentos/ordens de serviço).
 * Extraído de `domain/vehicles/shared.ts` ao iniciar o Epic 3 para evitar
 * duplicar a mesma lógica em cada domínio nas fases seguintes.
 */

import { z } from "zod";
import { normalizeNullableFields } from "../foundation/envelope/response-envelope.js";
import { normalizePagination, type PaginationMeta } from "../foundation/pagination/pagination.js";

export const centralSchema = z.string().min(1, "central is required");

export const paginationInputShape = {
  page: z.number().int().positive().optional(),
  page_size: z.number().int().positive().optional(),
};

/** Normaliza um item bruto (undefined -> null em todos os campos de 1º nível). */
export function normalizeItem(item: Record<string, unknown>): Record<string, unknown> {
  return normalizeNullableFields(item);
}

/**
 * Trata defensivamente respostas cujo schema documentado é inconsistente
 * entre "um único objeto" e "uma lista" (inconsistência real já observada em
 * mais de um endpoint da Getrak API Core — ver domain/vehicles/shared.ts).
 */
export function extractArray(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) {
    return raw as Record<string, unknown>[];
  }
  if (raw && typeof raw === "object") {
    return [raw as Record<string, unknown>];
  }
  return [];
}

/**
 * `has_more`/`total_items`: usar quando o endpoint de origem não informa uma
 * contagem total confiável no payload. `total_items` fica `null` (US-003);
 * `has_more` é uma estimativa (página cheia -> provavelmente há mais).
 */
export function buildPaginationMeta(items: unknown[], page: number, page_size: number): PaginationMeta {
  return {
    page,
    page_size,
    total_items: null,
    has_more: items.length >= page_size,
  };
}

/**
 * Traduz a paginação padronizada (US-004) para `{[limitParamName]: page_size, offset}`,
 * quando o endpoint de origem usa o padrão limit/offset (nome do parâmetro
 * de limite varia por endpoint — ver ED-01/reference/openapi.json).
 */
export function buildLimitOffsetPagination(
  input: { page?: number; page_size?: number },
  limitParamName: string,
): { query: Record<string, number>; page: number; page_size: number } {
  const { page, page_size } = normalizePagination(input);
  return {
    query: { [limitParamName]: page_size, offset: (page - 1) * page_size },
    page,
    page_size,
  };
}

/**
 * Traduz a paginação padronizada (US-004) para `{page, [perPageParamName]: page_size}`,
 * quando o endpoint de origem usa nativamente page/per_page.
 */
export function buildPagePerPagePagination(
  input: { page?: number; page_size?: number },
  perPageParamName = "per_page",
): { query: Record<string, number>; page: number; page_size: number } {
  const { page, page_size } = normalizePagination(input);
  return {
    query: { page, [perPageParamName]: page_size },
    page,
    page_size,
  };
}

/**
 * Epic 10 (Getrak Web, `page`/`per_page`): ao contrário de Epic 2-9, estes
 * endpoints confirmadamente devolvem um envelope real de paginação —
 * `{ data: [...], page, pages, total }` (confirmado individualmente contra
 * reference/openapi.json para US-035/036/039/040/041/042) — permitindo
 * `total_items`/`has_more` exatos em vez da estimativa usada em
 * `buildPaginationMeta`.
 */
export function extractPagePerPageEnvelope(
  raw: unknown,
  page: number,
  page_size: number,
): { items: Record<string, unknown>[]; meta: PaginationMeta } {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const items = Array.isArray(obj.data) ? (obj.data as Record<string, unknown>[]) : [];
  const pages = typeof obj.pages === "number" ? obj.pages : null;
  const total = typeof obj.total === "number" ? obj.total : null;

  return {
    items,
    meta: {
      page,
      page_size,
      total_items: total,
      has_more: pages !== null ? page < pages : items.length >= page_size,
    },
  };
}

export { normalizePagination };
export type { PaginationMeta };
