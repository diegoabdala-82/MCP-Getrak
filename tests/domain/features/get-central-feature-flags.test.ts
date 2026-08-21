import { describe, expect, it } from "vitest";
import { createGetCentralFeatureFlagsTool } from "../../../src/domain/features/get-central-feature-flags.js";
import { createFakeApiCoreClient, createFakeDelegatedTokenManager, ctx } from "./test-helpers.js";

describe("US-104 — get_central_feature_flags", () => {
  it("retorna as feature flags normalizadas a partir do envelope {data: ...}", async () => {
    const fake = createFakeApiCoreClient({ data: { ai_monitoring: true, hide_getrak_store: false } });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetCentralFeatureFlagsTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(definition.inputSchema.parse({ central: "central-1" }), ctx);

    expect(result.data.feature_flags).toEqual({ ai_monitoring: true, hide_getrak_store: false });
    expect(fake.get).toHaveBeenCalledWith(expect.objectContaining({ path: "/v1.0/centrals/feature-flags" }));
  });

  it("chaves de feature flags não se sobrepõem às chaves de get_central_features (conceitos distintos, confirmado empiricamente)", async () => {
    const fake = createFakeApiCoreClient({
      data: { ai_monitoring: true, video_monitoring: true, hide_getrak_store: false, hide_home_carrousel: false, equipment: true, banner_countdown_v2: false },
    });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetCentralFeatureFlagsTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(definition.inputSchema.parse({ central: "central-1" }), ctx);

    const flagKeys = Object.keys(result.data.feature_flags);
    const knownFeatureKeys = ["show_driver_mobile", "show_speed_mobile", "restricted_vehicle_notification_mobile"];
    expect(flagKeys.some((k) => knownFeatureKeys.includes(k))).toBe(false);
  });
});
