import { describe, expect, it } from "vitest";
import { createSearchReportsTool } from "../../../src/domain/reports/search-reports.js";
import { createFakeApiCoreClient, createFakeDelegatedTokenManager, ctx } from "./test-helpers.js";

describe("US-049 — search_reports", () => {
  it("retorna relatórios normalizados e paginados dentro da central autorizada", async () => {
    const fake = createFakeApiCoreClient({
      data: [{ id: 115, report_type: "km_traveled", status: 3 }],
      page: 1,
      pages: 1,
      total: 1,
    });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchReportsTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(
      definition.inputSchema.parse({ central: "central-1", report_types: ["km_traveled"] }),
      ctx,
    );

    expect(result.data.reports).toEqual([{ id: 115, report_type: "km_traveled", status: 3 }]);
    expect(result.authScheme).toBe("oauth2Password");
  });

  it("traduz filtros/ordenação para a query real, sem sufixo [] no filtro de tipos/status, e sempre envia page+per_page juntos", async () => {
    const fake = createFakeApiCoreClient({ data: [], page: 1, pages: 1, total: 0 });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchReportsTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const input = definition.inputSchema.parse({
      central: "central-1",
      report_types: ["km_traveled", "speed"],
      statuses: [1, 3],
      created_after: "2026-08-01T00:00:00.000Z",
      created_before: "2026-08-19T23:59:59.000Z",
      sort_direction: "DESC",
      page: 2,
      page_size: 10,
    });
    await definition.handler(input, ctx);

    expect(fake.get).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/v1.0/report/reports",
        query: {
          "filters[report_type][in]": ["km_traveled", "speed"],
          "filters[status]": [1, 3],
          "filters[created_at_start]": "2026-08-01T00:00:00.000Z",
          "filters[created_at_end]": "2026-08-19T23:59:59.000Z",
          "order[created_at]": "DESC",
          page: 2,
          per_page: 10,
        },
        authScheme: "oauth2Password",
      }),
    );
  });

  it("sempre envia page e per_page mesmo sem paginação explícita no input (endpoint real exige os dois juntos)", async () => {
    const fake = createFakeApiCoreClient({ data: [], page: 1, pages: 1, total: 0 });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchReportsTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    await definition.handler(definition.inputSchema.parse({ central: "central-1" }), ctx);

    const callArgs = fake.get.mock.calls[0][0];
    expect(callArgs.query.page).toBeTypeOf("number");
    expect(callArgs.query.per_page).toBeTypeOf("number");
  });

  it("retorna lista vazia normalizada quando nenhum relatório corresponde ao filtro", async () => {
    const fake = createFakeApiCoreClient({ data: [], page: 1, pages: 0, total: 0 });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchReportsTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(
      definition.inputSchema.parse({ central: "central-1", report_types: ["totally_fake_type_xyz"] }),
      ctx,
    );

    expect(result.data.reports).toEqual([]);
    expect(result.data.pagination).toMatchObject({ total_items: 0 });
  });
});
