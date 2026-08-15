/**
 * Epic 9 — Clientes, Subclientes, Perfis e Centrais (US-030, US-031, US-033,
 * US-034). Ponto único de registro das 4 tools do domínio no
 * catálogo/servidor MCP.
 *
 * US-032 (consultar usuários) não é registrada aqui — bloqueada por
 * GAP-018 (ver domain/accounts/shared.ts e CLAUDE.md Seção 9).
 */

import type { RegisterDomainTool } from "../../server.js";
import { createGetCentralsTool } from "./get-centrals.js";
import { createGetUserProfilesTool } from "./get-user-profiles.js";
import { createSearchClientsTool } from "./search-clients.js";
import { createSearchSubclientsTool } from "./search-subclients.js";
import type { AccountsToolDeps } from "./shared.js";

export function registerAccountTools(registerDomainTool: RegisterDomainTool, deps: AccountsToolDeps): void {
  registerDomainTool(createSearchClientsTool(deps));
  registerDomainTool(createSearchSubclientsTool(deps));
  registerDomainTool(createGetUserProfilesTool(deps));
  registerDomainTool(createGetCentralsTool(deps));
}
