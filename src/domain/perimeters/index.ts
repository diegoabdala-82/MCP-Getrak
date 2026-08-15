/**
 * Epic 10 — Perimeters (US-040, US-041, US-042). Ponto único de registro
 * das 3 tools do domínio no catálogo/servidor MCP.
 */

import type { RegisterDomainTool } from "../../server.js";
import { createSearchGeofencesTool } from "./search-geofences.js";
import { createSearchPerimeterCategoriesTool } from "./search-perimeter-categories.js";
import { createSearchReferencePointsTool } from "./search-reference-points.js";
import type { PerimetersToolDeps } from "./shared.js";

export function registerPerimeterTools(registerDomainTool: RegisterDomainTool, deps: PerimetersToolDeps): void {
  registerDomainTool(createSearchGeofencesTool(deps));
  registerDomainTool(createSearchPerimeterCategoriesTool(deps));
  registerDomainTool(createSearchReferencePointsTool(deps));
}
