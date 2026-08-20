import { describe, expect, it } from "vitest";
import { createGetCentralFeaturesTool } from "../../../src/domain/features/get-central-features.js";
import { createFakeApiCoreClient, createFakeDelegatedTokenManager, ctx } from "./test-helpers.js";

describe("US-103 — get_central_features", () => {
  it("retorna as features normalizadas quando a resposta NÃO tem envelope data (raiz é o próprio objeto)", async () => {
    const fake = createFakeApiCoreClient({
      show_driver_mobile: true,
      show_speed_mobile: true,
      restricted_vehicle_notification_mobile: { title: "Rastreamento restrito", description: "..." },
    });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetCentralFeaturesTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(definition.inputSchema.parse({ central: "central-1" }), ctx);

    expect(result.data.features).toEqual({
      show_driver_mobile: true,
      show_speed_mobile: true,
      restricted_vehicle_notification_mobile: { title: "Rastreamento restrito", description: "..." },
    });
    expect(fake.get).toHaveBeenCalledWith(expect.objectContaining({ path: "/v1.0/centrals/features" }));
  });
});
