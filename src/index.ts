/**
 * Entry point do Getrak Core MCP.
 *
 * Wiring via stdio. Seleciona os adapters de produção (AWS Secrets Manager,
 * Redis/ElastiCache — TD-02/TD-04) quando a configuração de ambiente indica
 * que eles estão disponíveis; caso contrário usa os adapters de referência
 * locais (env vars, memória) — mesma interface em ambos os casos, nenhuma
 * lógica de negócio muda com a troca.
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { resolveEnvironment } from "./config/environment.js";
import { AuditLogger, StdoutAuditSink } from "./foundation/audit/audit-logger.js";
import { AwsSecretsManagerProvider } from "./foundation/auth/aws-secrets-provider.js";
import { AuthManager } from "./foundation/auth/auth-manager.js";
import { HttpOAuth2Client } from "./foundation/auth/oauth2-client.js";
import { createRedisClient } from "./foundation/auth/redis-client-factory.js";
import { RedisTokenCache } from "./foundation/auth/redis-token-cache.js";
import { EnvSecretsProvider, type SecretsProvider } from "./foundation/auth/secrets-provider.js";
import { InMemoryTokenCache, type TokenCache } from "./foundation/auth/token-cache.js";
import {
  CentralAuthorizationGuard,
  StaticCentralAuthorizationProvider,
} from "./foundation/authorization/central-authorization.js";
import { AllowAllToolPermissionChecker, ToolCatalog } from "./foundation/catalog/tool-catalog.js";
import { StaticConsumerIdentityResolver } from "./foundation/identity/consumer-context.js";
import { ToolRuntime } from "./foundation/tool-runtime.js";
import { createGetrakMcpServer } from "./server.js";

async function main() {
  const environment = resolveEnvironment();

  const auditLogger = new AuditLogger(new StdoutAuditSink());

  // GAP-004 (US-002): modelo de autorização por central ainda não definido.
  // Placeholder de configuração local até a fonte real existir.
  const authorizedCentralsByConsumer = parseAuthorizedCentralsFromEnv();
  const centralGuard = new CentralAuthorizationGuard(
    new StaticCentralAuthorizationProvider(authorizedCentralsByConsumer),
  );

  const authManager = new AuthManager(buildSecretsProvider(), buildTokenCache(), new HttpOAuth2Client());
  void authManager; // usado pelas tools de domínio via ApiCoreClient a partir da Fase 2

  const toolRuntime = new ToolRuntime(centralGuard, auditLogger);
  const catalog = new ToolCatalog();
  const permissionChecker = new AllowAllToolPermissionChecker();

  // GAP (US-001): identidade de conexão real ainda não definida no protocolo
  // de transporte; consumidor único fixo até então (ver StaticConsumerIdentityResolver).
  const identityResolver = new StaticConsumerIdentityResolver({ consumer_id: "claude-code" });

  const { server } = createGetrakMcpServer({
    environment,
    catalog,
    permissionChecker,
    identityResolver,
    toolRuntime,
    auditLogger,
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

function parseAuthorizedCentralsFromEnv(): Record<string, readonly string[]> {
  const raw = process.env.GETRAK_MCP_AUTHORIZED_CENTRALS_JSON;
  if (!raw) {
    return {};
  }
  return JSON.parse(raw) as Record<string, readonly string[]>;
}

/** Usa AWS Secrets Manager (TD-02) quando `GETRAK_MCP_USE_AWS_SECRETS=true`; senão, env vars locais. */
function buildSecretsProvider(): SecretsProvider {
  if (process.env.GETRAK_MCP_USE_AWS_SECRETS === "true") {
    return new AwsSecretsManagerProvider();
  }
  return new EnvSecretsProvider();
}

/** Usa Redis/ElastiCache (TD-04) quando `GETRAK_MCP_REDIS_URL` está configurada; senão, cache em memória. */
function buildTokenCache(): TokenCache {
  const redisUrl = process.env.GETRAK_MCP_REDIS_URL;
  if (redisUrl) {
    return new RedisTokenCache(createRedisClient({ url: redisUrl }));
  }
  return new InMemoryTokenCache();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Fatal error starting Getrak Core MCP:", err);
  process.exit(1);
});
