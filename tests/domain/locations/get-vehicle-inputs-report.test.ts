import { describe, expect, it } from "vitest";
import { createGetVehicleInputsReportTool } from "../../../src/domain/locations/get-vehicle-inputs-report.js";
import { createFakeApiCoreClient, ctx } from "./test-helpers.js";

describe("US-017 — get_vehicle_inputs_report", () => {
  it("normaliza o relatório de até 4 canais de entrada", async () => {
    const fake = createFakeApiCoreClient({
      "1": { estado: "ligado" },
      "2": { estado: "desligado" },
    });
    const { definition } = createGetVehicleInputsReportTool({ apiCoreClient: fake.client });

    const result = await definition.handler(
      definition.inputSchema.parse({
        central: "central-1",
        vehicle_id: "1234",
        start_date: "2024-09-12T00:00:00",
        end_date: "2024-09-12T23:59:59",
      }),
      ctx,
    );

    expect(result.data.inputs).toEqual({
      "1": { estado: "ligado" },
      "2": { estado: "desligado" },
      "3": null,
      "4": null,
    });
  });
});
