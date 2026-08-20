/**
 * Epic 15 — Clients, Getrak Web (US-061 a US-066). Ponto único de
 * registro das 6 tools do domínio no catálogo/servidor MCP.
 */

import type { RegisterDomainTool } from "../../server.js";
import { createGetClientsSummaryTool } from "./get-clients-summary.js";
import { createGetEntityImportDetailsTool } from "./get-entity-import-details.js";
import { createGetEntityImportItemsTool } from "./get-entity-import-items.js";
import { createGetSubclientsSummaryTool } from "./get-subclients-summary.js";
import { createSearchEntityImportRequestsTool } from "./search-entity-import-requests.js";
import { createSearchWebClientsTool } from "./search-web-clients.js";
import type { WebClientsToolDeps } from "./shared.js";

export function registerWebClientTools(registerDomainTool: RegisterDomainTool, deps: WebClientsToolDeps): void {
  registerDomainTool(createSearchWebClientsTool(deps));
  registerDomainTool(createGetClientsSummaryTool(deps));
  registerDomainTool(createGetSubclientsSummaryTool(deps));
  registerDomainTool(createSearchEntityImportRequestsTool(deps));
  registerDomainTool(createGetEntityImportDetailsTool(deps));
  registerDomainTool(createGetEntityImportItemsTool(deps));
}
