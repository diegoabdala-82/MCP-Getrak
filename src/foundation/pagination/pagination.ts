/**
 * US-004 — Paginação padronizada.
 *
 * Padrão: 50 itens por página. Máximo: 100 itens por página (TD-03).
 * Cada adapter de API deve encapsular o comportamento real de paginação do
 * endpoint correspondente (page/per_page, limit/offset, ou ausência) — nunca
 * assumir um único modelo genérico (ED-01, Open — Non-blocking: mapear o
 * comportamento real de cada endpoint da V1 ao implementar seu adapter e
 * documentar aqui/no adapter específico).
 */

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 100;

export interface PaginationInput {
  page?: number;
  page_size?: number;
}

export interface NormalizedPagination {
  page: number;
  page_size: number;
}

export interface PaginationMeta {
  page: number;
  page_size: number;
  total_items: number | null;
  has_more: boolean | null;
}

/**
 * Aplica os defaults/limites padronizados de paginação (US-004 AC):
 * sem parâmetro -> 50 itens; acima de 100 -> limitado a 100.
 */
export function normalizePagination(input: PaginationInput = {}): NormalizedPagination {
  const page = input.page !== undefined && input.page > 0 ? Math.floor(input.page) : 1;

  const requestedSize = input.page_size ?? DEFAULT_PAGE_SIZE;
  const page_size = Math.min(Math.max(Math.floor(requestedSize), 1), MAX_PAGE_SIZE);

  return { page, page_size };
}

/**
 * Contrato que cada adapter de endpoint implementa para traduzir entre a
 * paginação padronizada do MCP e o padrão real do endpoint de origem.
 * `TUpstreamQuery` é o formato de query específico do endpoint (ex.:
 * `{ page, per_page }` ou `{ limit, offset }`); `TUpstreamResponse` é o
 * payload bruto retornado por ele.
 */
export interface UpstreamPaginationAdapter<TUpstreamQuery, TUpstreamResponse, TItem> {
  /** Nome do padrão real do endpoint, para documentação/depuração (ED-01). */
  readonly upstreamPaginationStyle: string;
  toUpstreamQuery(pagination: NormalizedPagination): TUpstreamQuery;
  fromUpstreamResponse(raw: TUpstreamResponse, pagination: NormalizedPagination): {
    items: TItem[];
    meta: PaginationMeta;
  };
}

/** Adapter para endpoints que usam `page`/`per_page` nativamente. */
export function createPagePerPageAdapter<TItem>(params: {
  extractItems: (raw: { items?: TItem[] } & Record<string, unknown>) => TItem[];
  extractTotal?: (raw: Record<string, unknown>) => number | null;
}): UpstreamPaginationAdapter<{ page: number; per_page: number }, Record<string, unknown>, TItem> {
  return {
    upstreamPaginationStyle: "page/per_page",
    toUpstreamQuery: (pagination) => ({ page: pagination.page, per_page: pagination.page_size }),
    fromUpstreamResponse: (raw, pagination) => {
      const items = params.extractItems(raw as { items?: TItem[] } & Record<string, unknown>);
      const total = params.extractTotal ? params.extractTotal(raw) : null;
      return {
        items,
        meta: {
          page: pagination.page,
          page_size: pagination.page_size,
          total_items: total,
          has_more: total !== null ? pagination.page * pagination.page_size < total : items.length === pagination.page_size,
        },
      };
    },
  };
}

/** Adapter para endpoints que usam `limit`/`offset` nativamente. */
export function createLimitOffsetAdapter<TItem>(params: {
  extractItems: (raw: Record<string, unknown>) => TItem[];
  extractTotal?: (raw: Record<string, unknown>) => number | null;
}): UpstreamPaginationAdapter<{ limit: number; offset: number }, Record<string, unknown>, TItem> {
  return {
    upstreamPaginationStyle: "limit/offset",
    toUpstreamQuery: (pagination) => ({
      limit: pagination.page_size,
      offset: (pagination.page - 1) * pagination.page_size,
    }),
    fromUpstreamResponse: (raw, pagination) => {
      const items = params.extractItems(raw);
      const total = params.extractTotal ? params.extractTotal(raw) : null;
      return {
        items,
        meta: {
          page: pagination.page,
          page_size: pagination.page_size,
          total_items: total,
          has_more: total !== null ? pagination.page * pagination.page_size < total : items.length === pagination.page_size,
        },
      };
    },
  };
}

/**
 * Adapter para endpoints sem paginação nativa: o endpoint retorna a lista
 * completa e o MCP faz o corte client-side para respeitar o contrato
 * padronizado de página/tamanho.
 */
export function createClientSideSliceAdapter<TItem>(params: {
  extractItems: (raw: Record<string, unknown>) => TItem[];
}): UpstreamPaginationAdapter<Record<string, never>, Record<string, unknown>, TItem> {
  return {
    upstreamPaginationStyle: "none (client-side slicing)",
    toUpstreamQuery: () => ({}),
    fromUpstreamResponse: (raw, pagination) => {
      const all = params.extractItems(raw);
      const start = (pagination.page - 1) * pagination.page_size;
      const items = all.slice(start, start + pagination.page_size);
      return {
        items,
        meta: {
          page: pagination.page,
          page_size: pagination.page_size,
          total_items: all.length,
          has_more: start + pagination.page_size < all.length,
        },
      };
    },
  };
}
