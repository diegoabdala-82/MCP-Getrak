import { describe, expect, it } from "vitest";
import { createGetVehicleByPlateTool } from "../../../src/domain/web-vehicles/get-vehicle-by-plate.js";
import { createFakeApiCoreClient, createFakeDelegatedTokenManager, createRejectingApiCoreClient, ctx } from "./test-helpers.js";
import { McpToolError } from "../../../src/domain/errors.js";

describe("US-073 — get_vehicle_by_plate", () => {
  it("retorna o veículo correspondente a uma placa válida, normalizado", async () => {
    const fake = createFakeApiCoreClient({
      id: 452979,
      plate: "NYC1D62",
      chassis: "9C2NC4310CR044107",
      model: "HONDA/CB 300R",
      brand: "HONDA",
      central_id: 12101,
    });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetVehicleByPlateTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(definition.inputSchema.parse({ central: "central-1", plate: "NYC1D62" }), ctx);

    expect(result.data.vehicle).toMatchObject({ plate: "NYC1D62", brand: "HONDA" });
    expect(fake.get).toHaveBeenCalledWith(expect.objectContaining({ path: "/v1.0/vehicles/lookup/NYC1D62" }));
  });

  it("achado real: retorna 200 com dados de uma placa sintaticamente válida mesmo sem veículo correspondente na central (não filtra por central)", async () => {
    // Confirmado contra homologação real nesta rodada: uma placa inventada
    // (sem nenhum veículo Getrak associado) ainda retornou 200 com um
    // registro completo — este endpoint não se comporta como "consultar
    // meu cadastro", e sim como uma consulta de placa genérica. Este teste
    // documenta o comportamento observado, não afirma que ele é o desejado.
    const fake = createFakeApiCoreClient({ id: 14277, plate: "ZZZ0000", brand: "FORD", model: "KA SE 1.0 HA B", central_id: 12101 });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetVehicleByPlateTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(definition.inputSchema.parse({ central: "central-1", plate: "ZZZ0000" }), ctx);

    expect(result.data.vehicle).toMatchObject({ plate: "ZZZ0000", brand: "FORD" });
  });

  it("retorna erro VEHICLE_NOT_FOUND quando a API Core responde 404", async () => {
    const fake = createRejectingApiCoreClient(
      new McpToolError({ code: "VEHICLE_NOT_FOUND", message: "Resource not found.", retryable: false }),
    );
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetVehicleByPlateTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    await expect(
      definition.handler(definition.inputSchema.parse({ central: "central-1", plate: "ABC1234" }), ctx),
    ).rejects.toMatchObject({ code: "VEHICLE_NOT_FOUND" });
  });

  it("mascara/não expõe a placa em nenhum parâmetro proibido — segue como campo de entrada normal validado", () => {
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetVehicleByPlateTool({
      apiCoreClient: createFakeApiCoreClient({}).client,
      delegatedTokenManager: delegated.manager,
    });
    expect(() => definition.inputSchema.parse({ central: "central-1", plate: "" })).toThrow();
  });
});
