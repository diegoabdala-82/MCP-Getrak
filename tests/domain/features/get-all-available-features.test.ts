import { describe, expect, it } from "vitest";
import { createGetAllAvailableFeaturesTool } from "../../../src/domain/features/get-all-available-features.js";
import { createFakeApiCoreClient, createFakeDelegatedTokenManager, ctx } from "./test-helpers.js";

describe("US-105 — get_all_available_features", () => {
  it("retorna o catálogo normalizado a partir do envelope {data: [...]}", async () => {
    const fake = createFakeApiCoreClient({
      data: [{ identifier: "show_driver_mobile", group: null, value_type: "boolean", created_at: "2025-05-30T00:24:04.000Z", updated_at: null }],
    });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetAllAvailableFeaturesTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(definition.inputSchema.parse({ central: "central-1" }), ctx);

    expect(result.data.features).toEqual([
      { identifier: "show_driver_mobile", group: null, value_type: "boolean", created_at: "2025-05-30T00:24:04.000Z", updated_at: null },
    ]);
    expect(fake.get).toHaveBeenCalledWith(expect.objectContaining({ path: "/v1.0/centrals/all-features" }));
    expect(result.warnings?.[0]).toMatch(/not scoped by central/);
  });

  it("ACHADO: 'central' é obrigatório no schema Zod mesmo sendo um catálogo global (gate de autorização do MCP, não filtro do endpoint)", () => {
    const { definition } = createGetAllAvailableFeaturesTool({
      apiCoreClient: createFakeApiCoreClient({}).client,
      delegatedTokenManager: createFakeDelegatedTokenManager().manager,
    });

    expect(() => definition.inputSchema.parse({})).toThrow();
  });

  it("não envia nenhum parâmetro de central na query real à API Core (o endpoint upstream não filtra por central)", async () => {
    const fake = createFakeApiCoreClient({ data: [] });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetAllAvailableFeaturesTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    await definition.handler(definition.inputSchema.parse({ central: "central-1" }), ctx);

    expect(fake.get).toHaveBeenCalledWith(expect.objectContaining({ query: {} }));
  });
});
