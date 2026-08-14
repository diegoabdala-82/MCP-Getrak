import { describe, expect, it } from "vitest";
import { createGetWorkOrderReportTool } from "../../../src/domain/work-orders/get-work-order-report.js";
import { createFakeApiCoreClient, ctx } from "./test-helpers.js";

describe("US-025 — get_work_order_report", () => {
  it("retorna o relatório normalizado, enviando central e workOrderId no path", async () => {
    const fake = createFakeApiCoreClient({
      device: { serial: "X1" },
      installerUser: { name: "Joe" },
      tests: [],
      vehicle: { placa: "ABC1234" },
      workOrder: { id: 123, status: "closed" },
    });
    const { definition } = createGetWorkOrderReportTool({ apiCoreClient: fake.client });

    const result = await definition.handler(
      definition.inputSchema.parse({ central: "getrak", work_order_id: "123" }),
      ctx,
    );

    expect(result.data.report).toEqual({
      device: { serial: "X1" },
      installerUser: { name: "Joe" },
      tests: [],
      vehicle: { placa: "ABC1234" },
      workOrder: { id: 123, status: "closed" },
    });
    expect(fake.get).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/v0.1/instalador/central/getrak/ordem-servico/123/relatorio",
      }),
    );
  });
});
