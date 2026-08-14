import { describe, expect, it } from "vitest";
import { createGetOfflineTreatmentsTool } from "../../../src/domain/locations/get-offline-treatments.js";
import { createFakeApiCoreClient, ctx } from "./test-helpers.js";

describe("US-018 — get_offline_treatments", () => {
  it("retorna tratamentos normalizados com paginação exata do upstream", async () => {
    const fake = createFakeApiCoreClient({
      data: [{ id: 1, vehicle_id: 42, status: "pending" }],
      page: 1,
      pages: 3,
      total: 60,
    });
    const { definition } = createGetOfflineTreatmentsTool({ apiCoreClient: fake.client });

    const result = await definition.handler(definition.inputSchema.parse({ central: "central-1" }), ctx);

    expect(result.data.treatments).toEqual([{ id: 1, vehicle_id: 42, status: "pending" }]);
    expect(result.data.pagination).toEqual({ page: 1, page_size: 50, total_items: 60, has_more: true });
  });

  it("traduz vehicle_id para o formato real filters[]={...} (confirmado no code sample do openapi.json)", async () => {
    const fake = createFakeApiCoreClient({ data: [], page: 1, pages: 1, total: 0 });
    const { definition } = createGetOfflineTreatmentsTool({ apiCoreClient: fake.client });

    await definition.handler(definition.inputSchema.parse({ central: "central-1", vehicle_id: "123" }), ctx);

    expect(fake.get).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/v1.0/localization/offline-treatment",
        query: expect.objectContaining({ "filters[]": [JSON.stringify({ vehicle_id: "123" })] }),
      }),
    );
  });

  it("omite filters[] quando nenhum vehicle_id é informado", async () => {
    const fake = createFakeApiCoreClient({ data: [], page: 1, pages: 1, total: 0 });
    const { definition } = createGetOfflineTreatmentsTool({ apiCoreClient: fake.client });

    await definition.handler(definition.inputSchema.parse({ central: "central-1" }), ctx);

    expect(fake.get).toHaveBeenCalledWith(
      expect.objectContaining({ query: expect.objectContaining({ "filters[]": undefined }) }),
    );
  });

  it("sempre envia fields[] com o conjunto completo de campos documentados (confirmado em produção: sem isso, o endpoint retorna só {id})", async () => {
    const fake = createFakeApiCoreClient({ data: [], page: 1, pages: 1, total: 0 });
    const { definition } = createGetOfflineTreatmentsTool({ apiCoreClient: fake.client });

    await definition.handler(definition.inputSchema.parse({ central: "central-1" }), ctx);

    expect(fake.get).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({
          "fields[]": [
            "id",
            "vehicle_id",
            "status",
            "central_id",
            "created_at",
            "finished_at",
            "finished_by",
            "ignore_until",
            "reason",
            "started_by",
          ],
        }),
      }),
    );
  });
});
