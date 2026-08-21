import { describe, expect, it } from "vitest";
import { createGetMaintenanceServicesSummaryTool } from "../../../src/domain/maintenance/get-maintenance-services-summary.js";
import { createFakeApiCoreClient, createFakeDelegatedTokenManager, ctx } from "./test-helpers.js";

describe("US-056 — get_maintenance_services_summary", () => {
  it("retorna o resumo agregado de serviços de manutenção", async () => {
    const fake = createFakeApiCoreClient({ total: 13, active: 13, inactive: 0 });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetMaintenanceServicesSummaryTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(definition.inputSchema.parse({ central: "central-1" }), ctx);

    expect(result.data.summary).toEqual({ total: 13, active: 13, inactive: 0 });
    expect(fake.get).toHaveBeenCalledWith(expect.objectContaining({ path: "/v2.0/maintenance/services/summary", query: {} }));
  });
});
