import { describe, expect, it } from "vitest";
import { createGetWorkOrderDetailsTool } from "../../../src/domain/work-orders/get-work-order-details.js";
import { createFakeApiCoreClient, ctx } from "./test-helpers.js";

describe("US-022 — get_work_order_details", () => {
  it("retorna os detalhes normalizados da ordem (desembrulhando a chave data do endpoint)", async () => {
    const fake = createFakeApiCoreClient({ data: { id: 123, status: "open", technician: undefined } });
    const { definition } = createGetWorkOrderDetailsTool({ apiCoreClient: fake.client });

    const result = await definition.handler(
      definition.inputSchema.parse({ central: "central-1", work_order_id: "123" }),
      ctx,
    );

    expect(result.data.work_order).toEqual({ id: 123, status: "open", technician: null });
    expect(fake.get).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/v1.0/installers/work-orders/123",
        authScheme: "oauth2ClientCredentials",
        notFoundCode: "WORK_ORDER_NOT_FOUND",
      }),
    );
  });

  it("retorna work_order: null quando a chave data está ausente", async () => {
    const fake = createFakeApiCoreClient({});
    const { definition } = createGetWorkOrderDetailsTool({ apiCoreClient: fake.client });
    const result = await definition.handler(
      definition.inputSchema.parse({ central: "central-1", work_order_id: "999" }),
      ctx,
    );
    expect(result.data.work_order).toBeNull();
  });

  it("exige work_order_id", () => {
    const { definition } = createGetWorkOrderDetailsTool({ apiCoreClient: createFakeApiCoreClient({}).client });
    expect(() => definition.inputSchema.parse({ central: "central-1" })).toThrow();
  });
});
