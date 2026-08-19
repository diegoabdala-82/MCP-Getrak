/**
 * Epic 13 — Reports (US-049, US-050). Ponto único de registro das 2 tools
 * do domínio no catálogo/servidor MCP.
 */

import type { RegisterDomainTool } from "../../server.js";
import { createGetReportsSummaryTool } from "./get-reports-summary.js";
import { createSearchReportsTool } from "./search-reports.js";
import type { ReportsToolDeps } from "./shared.js";

export function registerReportTools(registerDomainTool: RegisterDomainTool, deps: ReportsToolDeps): void {
  registerDomainTool(createSearchReportsTool(deps));
  registerDomainTool(createGetReportsSummaryTool(deps));
}
