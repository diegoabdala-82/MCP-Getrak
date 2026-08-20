import { describe, expect, it } from "vitest";
import { McpToolError } from "../../../src/domain/errors.js";
import { createGetJourneyDetailsTool } from "../../../src/domain/journeys/get-journey-details.js";
import { createFakeApiCoreClient, createFakeDelegatedTokenManager, createRejectingApiCoreClient, ctx } from "./test-helpers.js";

describe("US-081 — get_journey_details", () => {
  it("retorna a viagem normalizada para um id válido", async () => {
    const fake = createFakeApiCoreClient({ data: { id: 33974551, status: "F", vehicle_id: 4061891 } });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetJourneyDetailsTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(definition.inputSchema.parse({ central: "central-1", id: 33974551 }), ctx);

    expect(result.data.journey).toEqual({ id: 33974551, status: "F", vehicle_id: 4061891 });
    expect(fake.get).toHaveBeenCalledWith(
      expect.objectContaining({ path: "/v1.0/journeys/33974551", notFoundCode: "JOURNEY_NOT_FOUND" }),
    );
  });

  it("normaliza viagem inexistente para JOURNEY_NOT_FOUND", async () => {
    const fake = createRejectingApiCoreClient(
      new McpToolError({ code: "JOURNEY_NOT_FOUND", message: "Journey not found.", retryable: false }),
    );
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetJourneyDetailsTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    await expect(
      definition.handler(definition.inputSchema.parse({ central: "central-1", id: 999999999 }), ctx),
    ).rejects.toMatchObject({ code: "JOURNEY_NOT_FOUND" });
  });

  it("envia include[]=driver quando include_driver=true", async () => {
    const fake = createFakeApiCoreClient({ data: { id: 1 } });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetJourneyDetailsTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    await definition.handler(definition.inputSchema.parse({ central: "central-1", id: 1, include_driver: true }), ctx);

    expect(fake.get).toHaveBeenCalledWith(expect.objectContaining({ query: { "include[]": ["driver"] } }));
  });
});
