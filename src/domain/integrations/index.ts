/**
 * Epic 10 — Integrations (US-039). Ponto único de registro da tool do
 * domínio no catálogo/servidor MCP.
 */

import type { RegisterDomainTool } from "../../server.js";
import { createSearchCentralIntegrationsTool } from "./search-central-integrations.js";
import type { IntegrationsToolDeps } from "./shared.js";

export function registerIntegrationTools(registerDomainTool: RegisterDomainTool, deps: IntegrationsToolDeps): void {
  registerDomainTool(createSearchCentralIntegrationsTool(deps));
}
