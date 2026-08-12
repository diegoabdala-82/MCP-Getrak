/**
 * Pipeline reutilizável de execução de tool — o ponto central que compõe a
 * fundação da Fase 1 (US-001 a US-006) para que as tools de domínio da Fase 2
 * em diante não precisem duplicar autenticação, validação de central,
 * envelope de resposta, auditoria ou tratamento de erro. Cada tool de
 * domínio só implementa `handler` (a lógica específica dela) e registra um
 * `ToolDefinition` neste runtime.
 */

import { randomUUID } from "node:crypto";
import type { z } from "zod";
import type { Environment } from "../config/environment.js";
import type { ErrorEnvelope } from "../domain/errors.js";
import { toMcpToolError } from "../domain/errors.js";
import type { AuditLogger, AuditRisk } from "./audit/audit-logger.js";
import type { CentralAuthorizationGuard } from "./authorization/central-authorization.js";
import { buildErrorEnvelope, buildSuccessEnvelope, type SuccessEnvelope } from "./envelope/response-envelope.js";
import type { ConsumerContext } from "./identity/consumer-context.js";

export interface ToolHandlerContext {
  requestId: string;
  /** `null` quando a tool não requer central (ex.: nenhuma na V1 de domínio, mas possível em infra). */
  central: string | null;
  environment: Environment;
  consumer: ConsumerContext;
}

export interface ToolHandlerResult<TData> {
  data: TData;
  /** Endpoint(s) de origem chamados — usado apenas em auditoria, nunca exposto ao consumidor. */
  endpoints: string[];
  warnings?: string[];
  partial?: boolean;
  affectedEntities?: string[];
}

export interface ToolDefinition<TInput, TData> {
  name: string;
  risk: AuditRisk;
  /** Toda tool de domínio da V1 requer central (CLAUDE.md Seção 3); só infraestrutura pode dispensar. */
  requiresCentral: boolean;
  inputSchema: z.ZodType<TInput>;
  /** Extrai a central do input já validado, quando `requiresCentral` é true. */
  getCentral?: (input: TInput) => string;
  handler: (input: TInput, ctx: ToolHandlerContext) => Promise<ToolHandlerResult<TData>>;
}

export interface ToolExecutionEnvironment {
  consumer: ConsumerContext;
  environment: Environment;
}

export class ToolRuntime {
  constructor(
    private readonly centralGuard: CentralAuthorizationGuard,
    private readonly auditLogger: AuditLogger,
    private readonly clock: () => number = Date.now,
  ) {}

  async execute<TInput, TData>(
    definition: ToolDefinition<TInput, TData>,
    rawInput: unknown,
    execEnv: ToolExecutionEnvironment,
  ): Promise<SuccessEnvelope<TData> | ErrorEnvelope> {
    const requestId = randomUUID();
    const startedAt = this.clock();
    let central: string | null = null;

    try {
      const parsedInput = definition.inputSchema.parse(rawInput);

      if (definition.requiresCentral) {
        if (!definition.getCentral) {
          throw new Error(
            `Tool "${definition.name}" declares requiresCentral=true but provides no getCentral().`,
          );
        }
        central = definition.getCentral(parsedInput);
        await this.centralGuard.assertAuthorized({
          consumer: execEnv.consumer,
          central,
        });
      }

      const result = await definition.handler(parsedInput, {
        requestId,
        central,
        environment: execEnv.environment,
        consumer: execEnv.consumer,
      });

      const envelope = buildSuccessEnvelope({
        data: result.data,
        requestId,
        central,
        partial: result.partial ?? false,
        warnings: result.warnings ?? [],
      });

      await this.auditLogger.record({
        request_id: requestId,
        consumer_id: execEnv.consumer.consumer_id,
        environment: execEnv.environment,
        central,
        tool: definition.name,
        endpoints: result.endpoints,
        risk: definition.risk,
        result: "success",
        duration_ms: this.clock() - startedAt,
        affected_entities: result.affectedEntities,
        timestamp: new Date(startedAt).toISOString(),
      });

      return envelope;
    } catch (err) {
      const toolError = toMcpToolError(err);
      const envelope = buildErrorEnvelope(toolError, requestId);

      await this.auditLogger.record({
        request_id: requestId,
        consumer_id: execEnv.consumer.consumer_id,
        environment: execEnv.environment,
        central,
        tool: definition.name,
        endpoints: [],
        risk: definition.risk,
        result: toolError.code === "CENTRAL_NOT_AUTHORIZED" ? "blocked" : "error",
        error_code: toolError.code,
        duration_ms: this.clock() - startedAt,
        timestamp: new Date(startedAt).toISOString(),
      });

      return envelope;
    }
  }
}
