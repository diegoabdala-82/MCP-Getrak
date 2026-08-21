import { describe, expect, it } from "vitest";
import { createGetMaintenancesSummaryTool } from "../../../src/domain/maintenance/get-maintenances-summary.js";
import { createFakeApiCoreClient, createFakeDelegatedTokenManager, ctx } from "./test-helpers.js";

describe("US-058 — get_maintenances_summary", () => {
  it("retorna o resumo agregado quando nenhum filtro é informado", async () => {
    const fake = createFakeApiCoreClient({
      next_maintenances: { total_value_cents: 0, count: 1, days_ahead: 30 },
      overdue_maintenances: { total_value_cents: 665500, count: 9 },
      maintenance_cost: { total_value_cents: 65000, count: 1, days_back: 30 },
    });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetMaintenancesSummaryTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(definition.inputSchema.parse({ central: "central-1" }), ctx);

    expect(result.data.summary).toMatchObject({ overdue_maintenances: { count: 9 } });
  });

  it("retorna resumo zerado normalizado (não erro) para um vehicle_id inexistente", async () => {
    const fake = createFakeApiCoreClient({
      next_maintenances: { total_value_cents: 0, count: 0, days_ahead: 30 },
      overdue_maintenances: { total_value_cents: 0, count: 0 },
      maintenance_cost: { total_value_cents: 0, count: 0, days_back: 30 },
    });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetMaintenancesSummaryTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(
      definition.inputSchema.parse({ central: "central-1", vehicle_id: 999999999 }),
      ctx,
    );

    expect(result.data.summary).toMatchObject({ overdue_maintenances: { count: 0 } });
  });
});
