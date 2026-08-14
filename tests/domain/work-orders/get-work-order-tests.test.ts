import { describe, expect, it } from "vitest";
import { createGetWorkOrderTestsTool } from "../../../src/domain/work-orders/get-work-order-tests.js";
import { createFakeApiCoreClient, ctx } from "./test-helpers.js";

describe("US-023 — get_work_order_tests", () => {
  it("retorna testes normalizados com paginação exata do upstream", async () => {
    const fake = createFakeApiCoreClient({
      data: [{ id: 1, test_definition_id: 5, status: "passed" }],
      page: 1,
      pages: 2,
      total: 30,
    });
    const { definition } = createGetWorkOrderTestsTool({ apiCoreClient: fake.client });

    const result = await definition.handler(
      definition.inputSchema.parse({ central: "central-1", work_order_id: "123" }),
      ctx,
    );

    expect(result.data.tests).toEqual([{ id: 1, test_definition_id: 5, status: "passed" }]);
    expect(result.data.pagination).toEqual({ page: 1, page_size: 50, total_items: 30, has_more: true });
    expect(fake.get).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/v1.0/installers/work-orders/123/tests",
        query: { page: 1, per_page: 50 },
      }),
    );
  });

  it("traduz a paginação padronizada para page/per_page nativos deste endpoint", async () => {
    const fake = createFakeApiCoreClient({ data: [], page: 2, pages: 2, total: 5 });
    const { definition } = createGetWorkOrderTestsTool({ apiCoreClient: fake.client });
    await definition.handler(
      definition.inputSchema.parse({ central: "central-1", work_order_id: "123", page: 2, page_size: 10 }),
      ctx,
    );
    expect(fake.get).toHaveBeenCalledWith(expect.objectContaining({ query: { page: 2, per_page: 10 } }));
  });
});
