import { describe, expect, it } from "vitest";
import {
  createClientSideSliceAdapter,
  createLimitOffsetAdapter,
  createPagePerPageAdapter,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  normalizePagination,
} from "../../src/foundation/pagination/pagination.js";

describe("US-004 — paginação padronizada", () => {
  it("aplica o padrão de 50 itens por página quando nenhum parâmetro é informado", () => {
    expect(normalizePagination()).toEqual({ page: 1, page_size: DEFAULT_PAGE_SIZE });
  });

  it("limita a 100 itens quando solicitado mais que o máximo", () => {
    expect(normalizePagination({ page_size: 500 })).toEqual({ page: 1, page_size: MAX_PAGE_SIZE });
  });

  it("respeita um tamanho de página válido dentro do intervalo permitido", () => {
    expect(normalizePagination({ page: 3, page_size: 25 })).toEqual({ page: 3, page_size: 25 });
  });

  it("nunca produz página menor que 1 nem tamanho de página menor que 1", () => {
    expect(normalizePagination({ page: 0, page_size: 0 })).toEqual({ page: 1, page_size: 1 });
    expect(normalizePagination({ page: -5, page_size: -5 })).toEqual({ page: 1, page_size: 1 });
  });

  it("adapter page/per_page traduz a paginação padronizada para o formato nativo do endpoint", () => {
    const adapter = createPagePerPageAdapter<{ id: string }>({
      extractItems: (raw) => raw.items ?? [],
      extractTotal: (raw) => (raw.total as number) ?? null,
    });

    const pagination = normalizePagination({ page: 2, page_size: 50 });
    expect(adapter.toUpstreamQuery(pagination)).toEqual({ page: 2, per_page: 50 });

    const { items, meta } = adapter.fromUpstreamResponse(
      { items: [{ id: "a" }], total: 120 },
      pagination,
    );
    expect(items).toEqual([{ id: "a" }]);
    expect(meta).toEqual({ page: 2, page_size: 50, total_items: 120, has_more: true });
  });

  it("adapter limit/offset traduz a paginação padronizada para o formato nativo do endpoint", () => {
    const adapter = createLimitOffsetAdapter<{ id: string }>({
      extractItems: (raw) => (raw.data as { id: string }[]) ?? [],
    });

    const pagination = normalizePagination({ page: 3, page_size: 20 });
    expect(adapter.toUpstreamQuery(pagination)).toEqual({ limit: 20, offset: 40 });
  });

  it("adapter client-side aplica corte local quando o endpoint não pagina nativamente", () => {
    const adapter = createClientSideSliceAdapter<number>({
      extractItems: (raw) => raw.all as number[],
    });
    const pagination = normalizePagination({ page: 2, page_size: 2 });
    const { items, meta } = adapter.fromUpstreamResponse({ all: [1, 2, 3, 4, 5] }, pagination);
    expect(items).toEqual([3, 4]);
    expect(meta.total_items).toBe(5);
    expect(meta.has_more).toBe(true);
  });
});
