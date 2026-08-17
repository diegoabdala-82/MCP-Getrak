/**
 * Epic 16 — Web Users (US-067, US-068, US-069). Ponto único de registro
 * das 3 tools do domínio no catálogo/servidor MCP.
 */

import type { RegisterDomainTool } from "../../server.js";
import { createGetCurrentUserTool } from "./get-current-user.js";
import { createGetUserDetailsTool } from "./get-user-details.js";
import { createSearchWebUsersTool } from "./search-web-users.js";
import type { WebUsersToolDeps } from "./shared.js";

export function registerWebUserTools(registerDomainTool: RegisterDomainTool, deps: WebUsersToolDeps): void {
  registerDomainTool(createGetUserDetailsTool(deps));
  registerDomainTool(createSearchWebUsersTool(deps));
  registerDomainTool(createGetCurrentUserTool(deps));
}
