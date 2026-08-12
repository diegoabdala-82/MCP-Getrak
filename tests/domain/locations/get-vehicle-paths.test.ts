import { describe, expect, it } from "vitest";
import { createGetVehiclePathsTool } from "../../../src/domain/locations/get-vehicle-paths.js";
import { createFakeApiCoreClient, ctx } from "./test-helpers.js";

describe("US-015 — get_vehicle_paths", () => {
  it("retorna trajetos normalizados dentro do intervalo", async () => {
    const fake = createFakeApiCoreClient([{ lat: -19.9, lon: -43.9, status_online: 1, velocidade: 30 }]);
    const { definition } = createGetVehiclePathsTool({ apiCoreClient: fake.client });

    const result = await definition.handler(
      definition.inputSchema.parse({
        central: "central-1",
        vehicle_id: "1234",
        start_date: "2024-09-12T00:00:00",
        end_date: "2024-09-12T23:59:59",
      }),
      ctx,
    );

    expect(result.data.paths).toEqual([{ lat: -19.9, lon: -43.9, status_online: 1, velocidade: 30 }]);
    expect(fake.get).toHaveBeenCalledWith(expect.objectContaining({ path: expect.stringContaining("/v0.1/trajetos/1234/") }));
  });

  it("retorna lista vazia normalizada quando não há trajetos no período", async () => {
    const fake = createFakeApiCoreClient([]);
    const { definition } = createGetVehiclePathsTool({ apiCoreClient: fake.client });
    const result = await definition.handler(
      definition.inputSchema.parse({
        central: "central-1",
        vehicle_id: "1",
        start_date: "2024-09-12T00:00:00",
        end_date: "2024-09-12T23:59:59",
      }),
      ctx,
    );
    expect(result.data.paths).toEqual([]);
  });
});
