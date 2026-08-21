import { describe, expect, it } from "vitest";
import { createGetAvailableVehiclesForJourneyTool } from "../../../src/domain/journeys/get-available-vehicles-for-journey.js";
import { createFakeApiCoreClient, createFakeDelegatedTokenManager, ctx } from "./test-helpers.js";

describe("US-088 — get_available_vehicles_for_journey", () => {
  it("retorna veículos disponíveis normalizados, cortando client-side (endpoint não pagina de verdade)", async () => {
    const fake = createFakeApiCoreClient({ data: [{ vehicle_id: 1 }, { vehicle_id: 2 }, { vehicle_id: 3 }] });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetAvailableVehiclesForJourneyTool({
      apiCoreClient: fake.client,
      delegatedTokenManager: delegated.manager,
    });

    const result = await definition.handler(
      definition.inputSchema.parse({ central: "central-1", page: 1, page_size: 2 }),
      ctx,
    );

    expect(result.data.vehicles).toEqual([{ vehicle_id: 1 }, { vehicle_id: 2 }]);
    expect(result.data.pagination).toMatchObject({ total_items: 3, has_more: true });
    expect(result.warnings?.[0]).toMatch(/does not support server-side pagination/);
    expect(fake.get).toHaveBeenCalledWith(expect.objectContaining({ path: "/v1.0/journeys/vehicles/available" }));
  });

  it("retorna lista vazia normalizada quando nenhum veículo está disponível", async () => {
    const fake = createFakeApiCoreClient({ data: [] });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetAvailableVehiclesForJourneyTool({
      apiCoreClient: fake.client,
      delegatedTokenManager: delegated.manager,
    });

    const result = await definition.handler(definition.inputSchema.parse({ central: "central-1" }), ctx);

    expect(result.data.vehicles).toEqual([]);
  });

  it("envia include[]=drivers quando include_drivers=true", async () => {
    const fake = createFakeApiCoreClient({ data: [] });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetAvailableVehiclesForJourneyTool({
      apiCoreClient: fake.client,
      delegatedTokenManager: delegated.manager,
    });

    await definition.handler(definition.inputSchema.parse({ central: "central-1", include_drivers: true }), ctx);

    expect(fake.get).toHaveBeenCalledWith(expect.objectContaining({ query: expect.objectContaining({ "include[]": ["drivers"] }) }));
  });
});
