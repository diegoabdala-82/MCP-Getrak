import { describe, expect, it } from "vitest";
import { createGetVehicleStatusTool } from "../../../src/domain/web-vehicles/get-vehicle-status.js";
import { createFakeApiCoreClient, createFakeDelegatedTokenManager, createRejectingApiCoreClient, ctx } from "./test-helpers.js";
import { McpToolError } from "../../../src/domain/errors.js";

const REAL_RESPONSE = {
  serial_number: "M352094084587374",
  gps_time: null,
  latitude: null,
  longitude: null,
  speed: null,
  ignition: 0,
  entrys: "00000",
  plate: "NYC1D62",
  status: "restricted",
  vehicle_id: 4085381,
  odometer: null,
  hourmeter: null,
};

describe("US-074 — get_vehicle_status", () => {
  it("retorna o status normalizado de um veículo válido dentro da central autorizada", async () => {
    const fake = createFakeApiCoreClient(REAL_RESPONSE);
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetVehicleStatusTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(definition.inputSchema.parse({ central: "central-1", vehicle_id: 4085381 }), ctx);

    expect(result.data.status).toMatchObject({ plate: "NYC1D62", ignition: 0, vehicle_id: 4085381 });
    expect(fake.get).toHaveBeenCalledWith(expect.objectContaining({ path: "/v1.0/localization/vehicles-status/4085381" }));
  });

  it("retorna erro VEHICLE_NOT_FOUND para um vehicle_id inexistente", async () => {
    const fake = createRejectingApiCoreClient(
      new McpToolError({ code: "VEHICLE_NOT_FOUND", message: "Resource not found.", retryable: false }),
    );
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetVehicleStatusTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    await expect(
      definition.handler(definition.inputSchema.parse({ central: "central-1", vehicle_id: 999999999 }), ctx),
    ).rejects.toMatchObject({ code: "VEHICLE_NOT_FOUND" });
  });

  it("rejeita vehicle_id inválido (não positivo)", () => {
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetVehicleStatusTool({
      apiCoreClient: createFakeApiCoreClient({}).client,
      delegatedTokenManager: delegated.manager,
    });
    expect(() => definition.inputSchema.parse({ central: "central-1", vehicle_id: -1 })).toThrow();
  });
});
