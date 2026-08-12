import { describe, expect, it } from "vitest";
import { createGetOfflineTreatmentHistoryTool } from "../../../src/domain/locations/get-offline-treatment-history.js";
import { createFakeApiCoreClient, ctx } from "./test-helpers.js";

describe("US-019 — get_offline_treatment_history", () => {
  it("retorna o histórico normalizado de um tratamento offline específico", async () => {
    const fake = createFakeApiCoreClient([
      { id: 1, offline_treatment_id: 67890, type: "created", content: undefined },
    ]);
    const { definition } = createGetOfflineTreatmentHistoryTool({ apiCoreClient: fake.client });

    const result = await definition.handler(
      definition.inputSchema.parse({ central: "central-1", offline_treatment_id: "67890" }),
      ctx,
    );

    expect(result.data.history).toEqual([{ id: 1, offline_treatment_id: 67890, type: "created", content: null }]);
    expect(fake.get).toHaveBeenCalledWith(
      expect.objectContaining({ path: "/v1.0/localization/offline-treatment-history/id/67890" }),
    );
  });
});
