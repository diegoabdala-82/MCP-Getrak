import { describe, expect, it } from "vitest";
import { createGetReportsSummaryTool } from "../../../src/domain/reports/get-reports-summary.js";
import { createFakeApiCoreClient, createFakeDelegatedTokenManager, ctx } from "./test-helpers.js";

describe("US-050 — get_reports_summary", () => {
  it("retorna o resumo agregado quando nenhum filtro é informado", async () => {
    const fake = createFakeApiCoreClient({ reports: { individual: 454, scheduled: 769 }, schedules: 51 });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetReportsSummaryTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(definition.inputSchema.parse({ central: "central-1" }), ctx);

    expect(result.data.summary).toEqual({ reports: { individual: 454, scheduled: 769 }, schedules: 51 });
    expect(result.authScheme).toBe("oauth2Password");
    expect(fake.get).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/v1.0/report/reports/summary",
        query: { "filters[report_type][notin]": undefined },
      }),
    );
  });

  it("repassa exclude_report_types como filters[report_type][notin] sem sufixo []", async () => {
    const fake = createFakeApiCoreClient({ reports: { individual: 448, scheduled: 695 }, schedules: 51 });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetReportsSummaryTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(
      definition.inputSchema.parse({ central: "central-1", exclude_report_types: ["km_traveled"] }),
      ctx,
    );

    expect(result.data.summary).toEqual({ reports: { individual: 448, scheduled: 695 }, schedules: 51 });
    expect(fake.get).toHaveBeenCalledWith(
      expect.objectContaining({ query: { "filters[report_type][notin]": ["km_traveled"] } }),
    );
  });

  it("retorna contagens zeradas normalizadas quando não há nenhum relatório na central", async () => {
    const fake = createFakeApiCoreClient({ reports: { individual: 0, scheduled: 0 }, schedules: 0 });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetReportsSummaryTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(definition.inputSchema.parse({ central: "central-1" }), ctx);

    expect(result.data.summary).toEqual({ reports: { individual: 0, scheduled: 0 }, schedules: 0 });
  });
});
