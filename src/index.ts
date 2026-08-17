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
import { resolveEnvironment, type Environment } from "./config/environment.js";
import { AuditLogger, StdoutAuditSink } from "./foundation/audit/audit-logger.js";
import { AwsSecretsManagerProvider } from "./foundation/auth/aws-secrets-provider.js";
import { AwsUserCredentialsProvider } from "./foundation/auth/aws-user-credentials-provider.js";
import { AuthManager } from "./foundation/auth/auth-manager.js";
import { DelegatedTokenManager } from "./foundation/auth/delegated-token-manager.js";
import { MultipartFormOAuth2Client } from "./foundation/auth/multipart-oauth2-client.js";
import { HttpOAuth2Client } from "./foundation/auth/oauth2-client.js";
import { createRedisClient } from "./foundation/auth/redis-client-factory.js";
import { RedisTokenCache } from "./foundation/auth/redis-token-cache.js";
import { EnvSecretsProvider, type SecretsProvider } from "./foundation/auth/secrets-provider.js";
import { InMemoryTokenCache, type TokenCache } from "./foundation/auth/token-cache.js";
import { EnvUserCredentialsProvider, type UserCredentialsProvider } from "./foundation/auth/user-credentials-provider.js";
import {
  CentralAuthorizationGuard,
  StaticCentralAuthorizationProvider,
} from "./foundation/authorization/central-authorization.js";
import { AllowAllToolPermissionChecker, ToolCatalog } from "./foundation/catalog/tool-catalog.js";
import { ApiCoreClient } from "./foundation/http/api-core-client.js";
import { StaticConsumerIdentityResolver } from "./foundation/identity/consumer-context.js";
import { ToolRuntime } from "./foundation/tool-runtime.js";
import { registerAccessoryTools } from "./domain/accessories/index.js";
import { registerAccountTools } from "./domain/accounts/index.js";
import { registerEquipmentTools } from "./domain/equipments/index.js";
import { registerIntegrationTools } from "./domain/integrations/index.js";
import { registerLocationTools } from "./domain/locations/index.js";
import { registerPerimeterTools } from "./domain/perimeters/index.js";
import { registerVehicleTools } from "./domain/vehicles/index.js";
import { registerWebUserTools } from "./domain/web-users/index.js";
import { registerWorkOrderTools } from "./domain/work-orders/index.js";
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

  const tokenCache = buildTokenCache();
  const authManager = new AuthManager(buildSecretsProvider(), tokenCache, new HttpOAuth2Client());
  const apiCoreClient = new ApiCoreClient(resolveApiCoreBaseUrl(environment), authManager);

  // US-046/047/048: token delegado do usuário — infraestrutura separada da
  // credencial técnica acima (AuthManager), reutiliza o mesmo TokenCache
  // (namespaces distintos, ver buildDelegatedTokenNamespace). Usa
  // `MultipartFormOAuth2Client`, não `HttpOAuth2Client` — confirmado contra
  // chamada real que o endpoint de emissão exige multipart/form-data para
  // o escopo GetrakWeb (ver multipart-oauth2-client.ts); o modelo técnico
  // (Epic 3/5, não tocado) continua em x-www-form-urlencoded via
  // HttpOAuth2Client, já validado contra produção real nesse formato.
  const delegatedTokenManager = new DelegatedTokenManager(
    buildUserCredentialsProvider(),
    tokenCache,
    new MultipartFormOAuth2Client(),
  );

  const toolRuntime = new ToolRuntime(centralGuard, auditLogger);
  const catalog = new ToolCatalog();
  const permissionChecker = new AllowAllToolPermissionChecker();

  // GAP (US-001): identidade de conexão real ainda não definida no protocolo
  // de transporte; consumidor único fixo até então (ver StaticConsumerIdentityResolver).
  const identityResolver = new StaticConsumerIdentityResolver({ consumer_id: "claude-code" });

  const { server, registerDomainTool } = createGetrakMcpServer({
    environment,
    catalog,
    permissionChecker,
    identityResolver,
    toolRuntime,
    auditLogger,
  });

  registerVehicleTools(registerDomainTool, { apiCoreClient });
  registerLocationTools(registerDomainTool, { apiCoreClient });
  registerEquipmentTools(registerDomainTool, { apiCoreClient });
  registerWorkOrderTools(registerDomainTool, { apiCoreClient });
  registerAccountTools(registerDomainTool, { apiCoreClient });
  registerAccessoryTools(registerDomainTool, { apiCoreClient, delegatedTokenManager });
  registerIntegrationTools(registerDomainTool, { apiCoreClient, delegatedTokenManager });
  registerPerimeterTools(registerDomainTool, { apiCoreClient, delegatedTokenManager });
  registerWebUserTools(registerDomainTool, { apiCoreClient, delegatedTokenManager });

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

/**
 * US-046/ED-ID-05: usa AWS Secrets Manager (um segredo por usuário) quando
 * `GETRAK_MCP_USE_AWS_SECRETS=true` (mesma flag da credencial técnica);
 * senão, variáveis de ambiente locais por usuário — mecanismo mínimo,
 * não uma decisão fechada de produto (ver user-credentials-provider.ts).
 */
function buildUserCredentialsProvider(): UserCredentialsProvider {
  if (process.env.GETRAK_MCP_USE_AWS_SECRETS === "true") {
    return new AwsUserCredentialsProvider();
  }
  return new EnvUserCredentialsProvider();
}

/**
 * Base URL da Getrak API Core por ambiente — nunca aceita como parâmetro de
 * tool (CLAUDE.md Seção 3), sempre resolvida pela configuração do servidor.
 * Exige configuração explícita por ambiente em vez de um default implícito
 * apontando para produção (`https://api.getrak.com`, PRD/Contexto) — evita
 * que homologação/desenvolvimento acidentalmente chamem produção por falta
 * de configuração.
 */
function resolveApiCoreBaseUrl(environment: Environment): string {
  const varName = `GETRAK_MCP_${environment.toUpperCase()}_API_CORE_BASE_URL`;
  const value = process.env[varName];
  if (!value) {
    throw new Error(`Missing ${varName}: the Getrak API Core base URL for "${environment}" is not configured.`);
  }
  return value;
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Fatal error starting Getrak Core MCP:", err);
  process.exit(1);
});
