import { describe, expect, it } from "vitest";
import { createGetMaintenanceDetailsTool } from "../../../src/domain/maintenance/get-maintenance-details.js";
import { createFakeApiCoreClient, createFakeDelegatedTokenManager, ctx } from "./test-helpers.js";

describe("US-059 — get_maintenance_details", () => {
  it("sempre envia include[]=last_execution,services (não documentado, mas confirmado necessário)", async () => {
    const fake = createFakeApiCoreClient({
      id: 1,
      name: "Troca de óleo",
      last_execution: { id: null, date: null, odometer: null, hourmeter: null },
      services: [{ id: 1, name: "Troca de óleo" }],
    });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetMaintenanceDetailsTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(definition.inputSchema.parse({ central: "central-1", id: 1 }), ctx);

    expect(result.data.maintenance).toMatchObject({ last_execution: { id: null }, services: [{ id: 1 }] });
    expect(fake.get).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/v2.0/maintenance/maintenances/1",
        query: { "include[]": ["last_execution", "services"] },
        notFoundCode: "MAINTENANCE_NOT_FOUND",
      }),
    );
  });
});
