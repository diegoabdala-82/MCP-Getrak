import { describe, expect, it } from "vitest";
import { createGetVehicleLocationHistoryTool } from "../../../src/domain/locations/get-vehicle-location-history.js";
import { createFakeApiCoreClient, ctx } from "./test-helpers.js";

describe("US-014 — get_vehicle_location_history", () => {
  it("retorna histórico normalizado dentro do intervalo, usando path params codificados", async () => {
    const fake = createFakeApiCoreClient([
      { lat: -19.9, lon: -43.9, data: "2024-09-12 00:00:00", velocidade: 40 },
    ]);
    const { definition } = createGetVehicleLocationHistoryTool({ apiCoreClient: fake.client });

    const input = definition.inputSchema.parse({
      central: "central-1",
      vehicle_id: "1234",
      start_date: "2024-09-12T00:00:00",
      end_date: "2024-09-12T23:59:59",
    });
    const result = await definition.handler(input, ctx);

    expect(result.data.history).toEqual([{ lat: -19.9, lon: -43.9, data: "2024-09-12 00:00:00", velocidade: 40 }]);
    expect(fake.get).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/v0.1/recebidos/1234/2024-09-12T00%3A00%3A00/2024-09-12T23%3A59%3A59",
      }),
    );
  });

  it("aplica corte client-side de paginação (endpoint sem paginação nativa, GAP-003)", async () => {
    const items = Array.from({ length: 60 }, (_, i) => ({ data: `t${i}` }));
    const fake = createFakeApiCoreClient(items);
    const { definition } = createGetVehicleLocationHistoryTool({ apiCoreClient: fake.client });

    const result = await definition.handler(
      definition.inputSchema.parse({
        central: "central-1",
        vehicle_id: "1",
        start_date: "2024-09-12T00:00:00",
        end_date: "2024-09-12T23:59:59",
      }),
      ctx,
    );

    expect(result.data.history).toHaveLength(50);
    expect(result.data.pagination).toEqual({ page: 1, page_size: 50, total_items: 60, has_more: true });
  });

  it("rejeita formato de data fora do padrão YYYY-MM-DDTHH:mm:ss", () => {
    const { definition } = createGetVehicleLocationHistoryTool({ apiCoreClient: createFakeApiCoreClient([]).client });
    expect(() =>
      definition.inputSchema.parse({
        central: "central-1",
        vehicle_id: "1",
        start_date: "2024-09-12",
        end_date: "2024-09-12T23:59:59",
      }),
    ).toThrow();
  });
});
