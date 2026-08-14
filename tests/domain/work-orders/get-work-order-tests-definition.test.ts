import { describe, expect, it } from "vitest";
import { createGetWorkOrderTestsDefinitionTool } from "../../../src/domain/work-orders/get-work-order-tests-definition.js";
import { createFakeApiCoreClient, ctx } from "./test-helpers.js";

describe("US-024 — get_work_order_tests_definition", () => {
  it("retorna a definição de testes normalizada", async () => {
    const fake = createFakeApiCoreClient([
      { id: 1, work_order_id: 123, test_definition_id: 5, required: true, status: "pending" },
    ]);
    const { definition } = createGetWorkOrderTestsDefinitionTool({ apiCoreClient: fake.client });

    const result = await definition.handler(
      definition.inputSchema.parse({ central: "central-1", work_order_id: "123" }),
      ctx,
    );

    expect(result.data.tests_definition).toEqual([
      { id: 1, work_order_id: 123, test_definition_id: 5, required: true, status: "pending" },
    ]);
    expect(fake.get).toHaveBeenCalledWith(
      expect.objectContaining({ path: "/v1.0/installers/work-orders/123/tests-definition" }),
    );
  });

  it("retorna lista vazia normalizada quando não há definição de teste", async () => {
    const fake = createFakeApiCoreClient([]);
    const { definition } = createGetWorkOrderTestsDefinitionTool({ apiCoreClient: fake.client });
    const result = await definition.handler(
      definition.inputSchema.parse({ central: "central-1", work_order_id: "123" }),
      ctx,
    );
    expect(result.data.tests_definition).toEqual([]);
  });
});
