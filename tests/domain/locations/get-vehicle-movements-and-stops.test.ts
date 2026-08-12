import { describe, expect, it } from "vitest";
import { createGetVehicleMovementsAndStopsTool } from "../../../src/domain/locations/get-vehicle-movements-and-stops.js";
import { createFakeApiCoreClient, ctx } from "./test-helpers.js";

describe("US-016 — get_vehicle_movements_and_stops", () => {
  it("retorna relatório de deslocamentos e paradas normalizado", async () => {
    const fake = createFakeApiCoreClient([
      { motorista: "Joe", cpf_motorista: "00000000000", distancia: 1200, velocidade_media: 40 },
    ]);
    const { definition } = createGetVehicleMovementsAndStopsTool({ apiCoreClient: fake.client });

    const result = await definition.handler(
      definition.inputSchema.parse({
        central: "central-1",
        vehicle_id: "1234",
        start_date: "2024-09-12T00:00:00",
        end_date: "2024-09-12T23:59:59",
      }),
      ctx,
    );

    expect(result.data.movements).toEqual([
      { motorista: "Joe", cpf_motorista: "00000000000", distancia: 1200, velocidade_media: 40 },
    ]);
    expect(fake.get).toHaveBeenCalledWith(
      expect.objectContaining({ path: expect.stringContaining("/v0.1/deslocamentos/1234/") }),
    );
  });
});
