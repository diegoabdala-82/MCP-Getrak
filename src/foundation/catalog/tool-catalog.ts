/**
 * US-007 — Descoberta de tools via protocolo MCP e catálogo por domínio.
 *
 * Descoberta nativa via protocolo MCP (list tools), complementada por um
 * catálogo organizado por domínio, filtrado pelas permissões do consumidor.
 * Cada entrada informa: nome, descrição, intenção, leitura/escrita,
 * classificação de risco, ambiente, versão.
 */

import type { Environment } from "../../config/environment.js";

export const TOOL_DOMAINS = [
  "vehicles",
  "locations",
  "equipments",
  "work_orders",
  "accounts",
  "accessories",
  "integrations",
  "perimeters",
  "web_users",
  "web_vehicles",
  "notifications",
  "operations",
  "reports",
  "web_equipments",
  "telemetry",
  "webhooks",
] as const;
export type ToolDomain = (typeof TOOL_DOMAINS)[number];

export type ToolIntent = "read" | "write";
export type ToolRisk = "low" | "medium" | "high";

export interface ToolCatalogEntry {
  name: string;
  description: string;
  intent: ToolIntent;
  domain: ToolDomain;
  risk: ToolRisk;
  /** Ambientes em que a tool está disponível; "all" quando não restrita. */
  environments: readonly Environment[] | "all";
  version: string;
}

/**
 * Verifica se um consumidor está autorizado a ver/usar uma tool.
 *
 * GAP-004 (mesma categoria da autorização por central, US-002): o modelo de
 * permissões por consumidor/tool não está detalhado no PRD/Technical Brief.
 * Mantido plugável para não travar a filtragem do catálogo a uma suposição
 * definitiva.
 */
export interface ToolPermissionChecker {
  isAuthorized(consumerId: string, toolName: string): Promise<boolean>;
}

/**
 * Checker provisório que autoriza todas as tools registradas. Adequado para
 * o piloto de consumidor único (Claude Code); deve ser substituído quando o
 * modelo real de permissões por consumidor for definido (GAP-004).
 */
export class AllowAllToolPermissionChecker implements ToolPermissionChecker {
  async isAuthorized(): Promise<boolean> {
    return true;
  }
}

export class ToolCatalog {
  private readonly entries = new Map<string, ToolCatalogEntry>();

  register(entry: ToolCatalogEntry): void {
    if (this.entries.has(entry.name)) {
      throw new Error(`Tool "${entry.name}" is already registered in the catalog.`);
    }
    this.entries.set(entry.name, entry);
  }

  getAll(): ToolCatalogEntry[] {
    return [...this.entries.values()];
  }

  getByDomain(domain: ToolDomain): ToolCatalogEntry[] {
    return this.getAll().filter((entry) => entry.domain === domain);
  }

  get(name: string): ToolCatalogEntry | undefined {
    return this.entries.get(name);
  }

  /**
   * Retorna apenas as tools autorizadas para o consumidor — nenhuma tool não
   * autorizada deve aparecer na descoberta (US-007 AC).
   */
  async listForConsumer(
    consumerId: string,
    permissionChecker: ToolPermissionChecker,
  ): Promise<ToolCatalogEntry[]> {
    const authorized: ToolCatalogEntry[] = [];
    for (const entry of this.getAll()) {
      if (await permissionChecker.isAuthorized(consumerId, entry.name)) {
        authorized.push(entry);
      }
    }
    return authorized;
  }
}
