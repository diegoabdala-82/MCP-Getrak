import { describe, expect, it } from "vitest";
import { createGetVehicleEquipmentHistoryTool } from "../../../src/domain/web-vehicles/get-vehicle-equipment-history.js";
import { createFakeApiCoreClient, createFakeDelegatedTokenManager, createRejectingApiCoreClient, ctx } from "./test-helpers.js";
import { McpToolError } from "../../../src/domain/errors.js";

describe("US-072 — get_vehicle_equipment_history", () => {
  it("retorna o histórico de equipamentos normalizado para um veículo válido", async () => {
    const fake = createFakeApiCoreClient({
      data: [
        { id: 1, vehicle_id: 4085381, serial_number: "M352094084587374", linked_at: "2025-10-27T20:12:48.000Z", unlinked_at: null },
      ],
      total: 1,
      pages: 1,
    });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetVehicleEquipmentHistoryTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(
      definition.inputSchema.parse({ central: "central-1", vehicle_id: 4085381 }),
      ctx,
    );

    expect(result.data.history).toEqual([
      { id: 1, vehicle_id: 4085381, serial_number: "M352094084587374", linked_at: "2025-10-27T20:12:48.000Z", unlinked_at: null },
    ]);
  });

  it("lida com resposta real sem a chave 'page' (diferente do envelope padrão do resto do Epic 10/16/17)", async () => {
    const fake = createFakeApiCoreClient({ data: [], total: 0, pages: 0 });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetVehicleEquipmentHistoryTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(
      definition.inputSchema.parse({ central: "central-1", vehicle_id: 4085381, page: 3, page_size: 10 }),
      ctx,
    );

    expect(result.data.history).toEqual([]);
    expect(result.data.pagination).toMatchObject({ page: 3, page_size: 10, total_items: 0 });
  });

  it("traduz filter[search][inc] (singular, conforme documentado) e paginação com per_page", async () => {
    const fake = createFakeApiCoreClient({ data: [], total: 0, pages: 0 });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetVehicleEquipmentHistoryTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    await definition.handler(
      definition.inputSchema.parse({ central: "central-1", vehicle_id: 4085381, serial_number_contains: "M3520" }),
      ctx,
    );

    expect(fake.get).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/v1.0/vehicles/4085381/equipments-history",
        query: expect.objectContaining({ "filter[search][inc]": "M3520", page: 1, per_page: 50 }),
      }),
    );
  });

  it("retorna erro VEHICLE_NOT_FOUND para um id de veículo inexistente", async () => {
    const fake = createRejectingApiCoreClient(
      new McpToolError({ code: "VEHICLE_NOT_FOUND", message: "Resource not found.", retryable: false }),
    );
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetVehicleEquipmentHistoryTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    await expect(
      definition.handler(definition.inputSchema.parse({ central: "central-1", vehicle_id: 999999999 }), ctx),
    ).rejects.toMatchObject({ code: "VEHICLE_NOT_FOUND" });
  });
});
