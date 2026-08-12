/**
 * US-001 — Autenticação técnica por ambiente.
 *
 * `environment` nunca é aceito como parâmetro livre de tool (CLAUDE.md, Seção 3;
 * PRD RNF05). É sempre resolvido a partir da configuração da conexão MCP
 * (variável de ambiente do processo do servidor), nunca do agente chamador.
 */

export const ENVIRONMENTS = ["development", "homologation", "production"] as const;

export type Environment = (typeof ENVIRONMENTS)[number];

/**
 * Homologation é o ambiente padrão de desenvolvimento e testes.
 * Produção nunca é padrão (CLAUDE.md, Seção 2; PRD RNF05).
 */
export const DEFAULT_ENVIRONMENT: Environment = "homologation";

const ENVIRONMENT_VAR_NAME = "GETRAK_MCP_ENVIRONMENT";

export function isEnvironment(value: string): value is Environment {
  return (ENVIRONMENTS as readonly string[]).includes(value);
}

export interface ResolveEnvironmentOptions {
  /** Injetável para testes; por padrão usa `process.env`. */
  env?: NodeJS.ProcessEnv;
}

/**
 * Resolve o ambiente ativo do servidor MCP a partir da configuração do processo.
 * Nunca aceita `environment` vindo de um argumento de tool.
 */
export function resolveEnvironment(options: ResolveEnvironmentOptions = {}): Environment {
  const env = options.env ?? process.env;
  const raw = env[ENVIRONMENT_VAR_NAME]?.trim();

  if (!raw) {
    return DEFAULT_ENVIRONMENT;
  }

  if (!isEnvironment(raw)) {
    throw new Error(
      `Invalid ${ENVIRONMENT_VAR_NAME}: "${raw}". Expected one of: ${ENVIRONMENTS.join(", ")}.`,
    );
  }

  return raw;
}
