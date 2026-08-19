/**
 * Epic 18 — Notifications (US-077, US-078). Ponto único de registro das 2
 * tools do domínio no catálogo/servidor MCP.
 */

import type { RegisterDomainTool } from "../../server.js";
import { createGetMessagesAnalyticsTool } from "./get-messages-analytics.js";
import { createSearchMessagesTool } from "./search-messages.js";
import type { NotificationsToolDeps } from "./shared.js";

export function registerNotificationTools(registerDomainTool: RegisterDomainTool, deps: NotificationsToolDeps): void {
  registerDomainTool(createSearchMessagesTool(deps));
  registerDomainTool(createGetMessagesAnalyticsTool(deps));
}
