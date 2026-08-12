import { describe, expect, it } from "vitest";
import { AuditLogger, InMemoryAuditSink } from "../../../src/foundation/audit/audit-logger.js";
import {
  CentralAuthorizationGuard,
  StaticCentralAuthorizationProvider,
} from "../../../src/foundation/authorization/central-authorization.js";
import { ToolRuntime } from "../../../src/foundation/tool-runtime.js";
import { createGetVehicleCurrentLocationTool } from "../../../src/domain/locations/get-vehicle-current-location.js";
import { createFakeApiCoreClient } from "./test-helpers.js";

describe("get_vehicle_current_location — integração completa via ToolRuntime", () => {
  it("aplica autenticação/central/envelope/auditoria da fundação sem duplicar lógica na tool", async () => {
    const fake = createFakeApiCoreClient({ veiculos: { lat: -19.9, lon: -43.9 } });
    const { definition } = createGetVehicleCurrentLocationTool({ apiCoreClient: fake.client });

    const auditSink = new InMemoryAuditSink();
    const centralGuard = new CentralAuthorizationGuard(
      new StaticCentralAuthorizationProvider({ "consumer-a": ["central-1"] }),
    );
    const runtime = new ToolRuntime(centralGuard, new AuditLogger(auditSink));

    const envelope = await runtime.execute(
      definition,
      { central: "central-1", vehicle_id: "42" },
      { consumer: { consumer_id: "consumer-a" }, environment: "homologation" },
    );

    expect(envelope).toMatchObject({
      data: { location: { lat: -19.9, lon: -43.9 } },
      meta: { central: "central-1", partial: false },
    });
    expect(auditSink.records[0]).toMatchObject({ tool: "get_vehicle_current_location", result: "success" });
  });

  it("bloqueia cross-central antes de chamar a API Core", async () => {
    const fake = createFakeApiCoreClient({ veiculos: {} });
    const { definition } = createGetVehicleCurrentLocationTool({ apiCoreClient: fake.client });

    const centralGuard = new CentralAuthorizationGuard(
      new StaticCentralAuthorizationProvider({ "consumer-a": ["central-1"] }),
    );
    const runtime = new ToolRuntime(centralGuard, new AuditLogger(new InMemoryAuditSink()));

    const envelope = await runtime.execute(
      definition,
      { central: "central-99", vehicle_id: "42" },
      { consumer: { consumer_id: "consumer-a" }, environment: "homologation" },
    );

    expect(envelope).toMatchObject({ error: { code: "CENTRAL_NOT_AUTHORIZED" } });
    expect(fake.get).not.toHaveBeenCalled();
  });
});
