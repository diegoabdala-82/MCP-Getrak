import { describe, expect, it } from "vitest";
import { createGetVehicleByEquipmentTool } from "../../../src/domain/web-vehicles/get-vehicle-by-equipment.js";
import { createFakeApiCoreClient, createFakeDelegatedTokenManager, createRejectingApiCoreClient, ctx } from "./test-helpers.js";
import { McpToolError } from "../../../src/domain/errors.js";

describe("US-071 — get_vehicle_by_equipment", () => {
  it("retorna o veículo associado a um serial_number válido, normalizado", async () => {
    const fake = createFakeApiCoreClient({
      linked_at: "2025-10-27T20:12:48.000Z",
      serial_number: "M352094084587374",
      vehicle: { id: 4085381, plate: "NYC1D62", nickname: null },
    });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetVehicleByEquipmentTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(
      definition.inputSchema.parse({ central: "central-1", serial_number: "M352094084587374" }),
      ctx,
    );

    expect(result.data.link).toMatchObject({ serial_number: "M352094084587374", vehicle: { id: 4085381, plate: "NYC1D62" } });
    expect(fake.get).toHaveBeenCalledWith(
      expect.objectContaining({ path: "/v1.0/vehicles/equipments/M352094084587374" }),
    );
  });

  it("retorna erro VEHICLE_NOT_FOUND para serial_number sem veículo associado", async () => {
    const fake = createRejectingApiCoreClient(
      new McpToolError({ code: "VEHICLE_NOT_FOUND", message: "Resource not found.", retryable: false }),
    );
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetVehicleByEquipmentTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    await expect(
      definition.handler(definition.inputSchema.parse({ central: "central-1", serial_number: "NAO-EXISTE-999" }), ctx),
    ).rejects.toMatchObject({ code: "VEHICLE_NOT_FOUND" });
  });

  it("rejeita serial_number vazio", () => {
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetVehicleByEquipmentTool({
      apiCoreClient: createFakeApiCoreClient({}).client,
      delegatedTokenManager: delegated.manager,
    });
    expect(() => definition.inputSchema.parse({ central: "central-1", serial_number: "" })).toThrow();
  });
});
