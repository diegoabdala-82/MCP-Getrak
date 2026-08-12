import { z } from "zod";
import { describe, expect, it } from "vitest";
import { ErrorCodes } from "../../src/domain/errors.js";
import { AuditLogger, InMemoryAuditSink } from "../../src/foundation/audit/audit-logger.js";
import {
  CentralAuthorizationGuard,
  StaticCentralAuthorizationProvider,
} from "../../src/foundation/authorization/central-authorization.js";
import { ToolRuntime, type ToolDefinition } from "../../src/foundation/tool-runtime.js";

// Tool de exemplo usada só para validar o pipeline reutilizável — as tools
// reais de domínio (Fase 2) seguem exatamente este mesmo formato.
const searchVehiclesInputSchema = z.object({
  central: z.string(),
  plate: z.string().optional(),
  page: z.number().optional(),
  page_size: z.number().optional(),
});

type SearchVehiclesInput = z.infer<typeof searchVehiclesInputSchema>;

function buildRuntime(authorizedCentrals: Record<string, readonly string[]>) {
  const auditSink = new InMemoryAuditSink();
  const auditLogger = new AuditLogger(auditSink);
  const centralGuard = new CentralAuthorizationGuard(new StaticCentralAuthorizationProvider(authorizedCentrals));
  const runtime = new ToolRuntime(centralGuard, auditLogger);
  return { runtime, auditSink };
}

const baseExecEnv = { consumer: { consumer_id: "consumer-a" }, environment: "homologation" as const };

describe("ToolRuntime — pipeline reutilizável (US-001/002/003/005/006)", () => {
  it("executa uma tool com sucesso e produz o envelope padrão + registro de auditoria", async () => {
    const { runtime, auditSink } = buildRuntime({ "consumer-a": ["central-1"] });

    const definition: ToolDefinition<SearchVehiclesInput, { vehicles: string[] }> = {
      name: "search_vehicles",
      risk: "low",
      requiresCentral: true,
      inputSchema: searchVehiclesInputSchema,
      getCentral: (input) => input.central,
      handler: async (input) => ({
        data: { vehicles: [`vehicle-for-${input.central}`] },
        endpoints: ["GET /v0.2/veiculos"],
      }),
    };

    const envelope = await runtime.execute(definition, { central: "central-1" }, baseExecEnv);

    expect(envelope).toMatchObject({
      data: { vehicles: ["vehicle-for-central-1"] },
      meta: { central: "central-1", partial: false },
      warnings: [],
    });
    expect("meta" in envelope && envelope.meta.request_id).toBeTruthy();

    expect(auditSink.records).toHaveLength(1);
    expect(auditSink.records[0]).toMatchObject({ tool: "search_vehicles", result: "success", central: "central-1" });
  });

  it("bloqueia cross-central antes de chamar o handler e audita como 'blocked'", async () => {
    const { runtime, auditSink } = buildRuntime({ "consumer-a": ["central-1"] });
    let handlerCalled = false;

    const definition: ToolDefinition<SearchVehiclesInput, unknown> = {
      name: "search_vehicles",
      risk: "low",
      requiresCentral: true,
      inputSchema: searchVehiclesInputSchema,
      getCentral: (input) => input.central,
      handler: async () => {
        handlerCalled = true;
        return { data: {}, endpoints: [] };
      },
    };

    const envelope = await runtime.execute(definition, { central: "central-99" }, baseExecEnv);

    expect(handlerCalled).toBe(false);
    expect(envelope).toMatchObject({ error: { code: ErrorCodes.CENTRAL_NOT_AUTHORIZED, retryable: false } });
    expect(auditSink.records).toHaveLength(1);
    expect(auditSink.records[0]).toMatchObject({ result: "blocked", error_code: ErrorCodes.CENTRAL_NOT_AUTHORIZED });
  });

  it("normaliza erro de validação de entrada em VALIDATION_ERROR sem vazar detalhes internos", async () => {
    const { runtime } = buildRuntime({ "consumer-a": ["central-1"] });

    const definition: ToolDefinition<SearchVehiclesInput, unknown> = {
      name: "search_vehicles",
      risk: "low",
      requiresCentral: true,
      inputSchema: searchVehiclesInputSchema,
      getCentral: (input) => input.central,
      handler: async () => ({ data: {}, endpoints: [] }),
    };

    const envelope = await runtime.execute(definition, { plate: "ABC1234" }, baseExecEnv);
    expect(envelope).toMatchObject({ error: { code: ErrorCodes.VALIDATION_ERROR, retryable: false } });
  });

  it("normaliza uma falha inesperada do handler em INTERNAL_ERROR e ainda audita", async () => {
    const { runtime, auditSink } = buildRuntime({ "consumer-a": ["central-1"] });

    const definition: ToolDefinition<SearchVehiclesInput, unknown> = {
      name: "search_vehicles",
      risk: "low",
      requiresCentral: true,
      inputSchema: searchVehiclesInputSchema,
      getCentral: (input) => input.central,
      handler: async () => {
        throw new Error("boom");
      },
    };

    const envelope = await runtime.execute(definition, { central: "central-1" }, baseExecEnv);
    expect(envelope).toMatchObject({ error: { code: ErrorCodes.INTERNAL_ERROR } });
    expect(auditSink.records[0]).toMatchObject({ result: "error", error_code: ErrorCodes.INTERNAL_ERROR });
  });

  it("o schema de entrada da tool nunca declara parâmetros proibidos (environment, credenciais, tokens, URLs)", () => {
    const shape = searchVehiclesInputSchema.shape;
    for (const forbidden of ["environment", "client_id", "client_secret", "token", "access_token", "api_url"]) {
      expect(Object.prototype.hasOwnProperty.call(shape, forbidden)).toBe(false);
    }
  });
});
