import { describe, expect, it } from "vitest";
import { createGetVehicleCurrentLocationTool } from "../../../src/domain/locations/get-vehicle-current-location.js";
import { createFakeApiCoreClient, ctx } from "./test-helpers.js";

describe("US-013 — get_vehicle_current_location", () => {
  it("retorna latitude/longitude/velocidade/status normalizados a partir da forma real (veiculos indexado numericamente, confirmado em produção)", async () => {
    const fake = createFakeApiCoreClient({
      page: 1,
      pages: 1,
      total: 1,
      veiculos: { "0": { lat: -19.9, lon: -43.9, velocidade: 60, entradas: "1010", data: undefined } },
    });
    const { definition } = createGetVehicleCurrentLocationTool({ apiCoreClient: fake.client });

    const result = await definition.handler(
      definition.inputSchema.parse({ central: "central-1", vehicle_id: "42" }),
      ctx,
    );

    expect(result.data.location).toEqual({ lat: -19.9, lon: -43.9, velocidade: 60, entradas: "1010", data: null });
    expect(fake.get).toHaveBeenCalledWith(
      expect.objectContaining({ path: "/v0.1/localizacoes", query: { id: "42" } }),
    );
  });

  it("também aceita veiculos como array (outra forma confirmada em produção para o mesmo veículo/central)", async () => {
    const fake = createFakeApiCoreClient({
      page: 1,
      pages: 1,
      total: 1,
      veiculos: [{ lat: -19.9, lon: -43.9, velocidade: 60 }],
    });
    const { definition } = createGetVehicleCurrentLocationTool({ apiCoreClient: fake.client });

    const result = await definition.handler(
      definition.inputSchema.parse({ central: "central-1", vehicle_id: "42" }),
      ctx,
    );
    expect(result.data.location).toEqual({ lat: -19.9, lon: -43.9, velocidade: 60 });
  });

  it("também aceita a forma documentada no openapi.json (registro plano direto), defensivamente", async () => {
    const fake = createFakeApiCoreClient({
      page: 1,
      pages: 1,
      total: 1,
      veiculos: { lat: -19.9, lon: -43.9, velocidade: 60 },
    });
    const { definition } = createGetVehicleCurrentLocationTool({ apiCoreClient: fake.client });

    const result = await definition.handler(
      definition.inputSchema.parse({ central: "central-1", vehicle_id: "42" }),
      ctx,
    );
    expect(result.data.location).toEqual({ lat: -19.9, lon: -43.9, velocidade: 60 });
  });

  it("retorna location: null (não erro) quando o veículo não tem localização disponível", async () => {
    const fake = createFakeApiCoreClient({ page: 1, pages: 1, total: 0, veiculos: {} });
    const { definition } = createGetVehicleCurrentLocationTool({ apiCoreClient: fake.client });

    const result = await definition.handler(
      definition.inputSchema.parse({ central: "central-1", vehicle_id: "999" }),
      ctx,
    );
    expect(result.data.location).toBeNull();
  });

  it("exige vehicle_id (parâmetro obrigatório no endpoint real)", () => {
    const { definition } = createGetVehicleCurrentLocationTool({ apiCoreClient: createFakeApiCoreClient({}).client });
    expect(() => definition.inputSchema.parse({ central: "central-1" })).toThrow();
  });
});
