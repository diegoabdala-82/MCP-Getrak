/**
 * US-005 — Auditoria estruturada por chamada.
 *
 * Gera, para toda execução de tool (sucesso ou erro), um registro com:
 * request_id, usuário/agente, ambiente, central, tool, endpoint(s), método,
 * classificação de risco, resultado, status, duração, entidades afetadas —
 * com mascaramento de dados sensíveis (CLAUDE.md Seção 8; PRD RF05/RF06/RNF06).
 */

import type { Environment } from "../../config/environment.js";
import { deepMask } from "./masking.js";

export type AuditRisk = "low" | "medium" | "high";
export type AuditResult = "success" | "error" | "blocked";

export interface AuditRecord {
  request_id: string;
  consumer_id: string;
  environment: Environment;
  /** `null` quando a execução foi bloqueada antes da resolução de central, ou não aplicável. */
  central: string | null;
  tool: string;
  endpoints: string[];
  http_method?: string;
  risk: AuditRisk;
  result: AuditResult;
  status?: number;
  duration_ms: number;
  /** CLAUDE.md Seção 8: distingue token delegado (US-046) de credencial técnica (US-001). */
  auth_scheme?: "delegated_user" | "technical_client";
  affected_entities?: string[];
  error_code?: string;
  timestamp: string;
  /** Contexto adicional livre — sempre mascarado antes de gravar. */
  details?: Record<string, unknown>;
}

/** Destino de gravação do registro de auditoria (CloudWatch em produção via stdout estruturado). */
export interface AuditSink {
  write(record: AuditRecord): Promise<void> | void;
}

/**
 * Grava o registro de auditoria como JSON estruturado em stdout. Em AWS ECS
 * Fargate, o log driver `awslogs` captura stdout do container e o encaminha
 * para CloudWatch Logs (TD-02) — não é necessário um cliente CloudWatch
 * dedicado dentro da aplicação para a observabilidade inicial.
 */
export class StdoutAuditSink implements AuditSink {
  write(record: AuditRecord): void {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ type: "audit", ...record }));
  }
}

/** Sink em memória, útil para testes — nunca usar em produção. */
export class InMemoryAuditSink implements AuditSink {
  readonly records: AuditRecord[] = [];

  write(record: AuditRecord): void {
    this.records.push(record);
  }
}

export class AuditLogger {
  constructor(private readonly sink: AuditSink) {}

  async record(record: AuditRecord): Promise<void> {
    const masked = deepMask({ ...record }) as AuditRecord;
    await this.sink.write(masked);
  }
}
