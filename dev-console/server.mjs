/**
 * Console de teste manual do Getrak Core MCP — NÃO é parte do produto MCP
 * (não é uma tool, não é exposto ao agente de IA). É uma ferramenta de
 * desenvolvimento local para inspecionar o catálogo de tools registradas e
 * chamá-las manualmente, ponta a ponta, pelo protocolo MCP real (stdio) —
 * o mesmo caminho usado nos smoke tests manuais já feitos nesta sessão.
 *
 * Nunca aceita credencial/ambiente pela UI (CLAUDE.md Seção 3): lê tudo de
 * variáveis de ambiente do processo, exatamente como o servidor MCP real
 * faz — o console só passa esse ambiente adiante ao processo filho.
 *
 * Uso: node dev-console/server.mjs (com as mesmas env vars de
 * GETRAK_MCP_* já usadas para rodar o servidor normalmente). Ver README.md
 * nesta pasta.
 */

import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");
const PORT = process.env.DEV_CONSOLE_PORT ? Number(process.env.DEV_CONSOLE_PORT) : 4390;

const STATIC_FILES = {
  "/": { file: "index.html", type: "text/html; charset=utf-8" },
  "/app.js": { file: "app.js", type: "text/javascript; charset=utf-8" },
  "/style.css": { file: "style.css", type: "text/css; charset=utf-8" },
};

let clientPromise = null;

/** Conecta uma única vez ao servidor MCP real (spawn de src/index.ts via tsx) e reutiliza a conexão. */
function getClient() {
  if (!clientPromise) {
    clientPromise = (async () => {
      const transport = new StdioClientTransport({
        command: path.join(PROJECT_ROOT, "node_modules/.bin/tsx"),
        args: ["src/index.ts"],
        cwd: PROJECT_ROOT,
        env: process.env,
        stderr: "pipe",
      });
      transport.stderr?.on("data", (chunk) => process.stderr.write(`[mcp-server] ${chunk}`));

      const client = new Client({ name: "getrak-mcp-dev-console", version: "0.1.0" }, { capabilities: {} });
      await client.connect(transport);
      return client;
    })().catch((err) => {
      // Permite tentar reconectar numa próxima chamada em vez de travar o console para sempre.
      clientPromise = null;
      throw err;
    });
  }
  return clientPromise;
}

function sendJson(res, status, body) {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(json),
  });
  res.end(json);
}

async function readRequestBody(req) {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === "GET" && STATIC_FILES[url.pathname]) {
      const { file, type } = STATIC_FILES[url.pathname];
      const data = await readFile(path.join(__dirname, "public", file));
      res.writeHead(200, { "Content-Type": type });
      res.end(data);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/environment") {
      sendJson(res, 200, { environment: process.env.GETRAK_MCP_ENVIRONMENT || "homologation" });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/tools") {
      const client = await getClient();
      const result = await client.listTools();
      sendJson(res, 200, result);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/call") {
      const { name, arguments: toolArguments } = await readRequestBody(req);
      if (!name) {
        sendJson(res, 400, { error: { message: "Missing tool name." } });
        return;
      }
      const client = await getClient();
      const result = await client.callTool({ name, arguments: toolArguments ?? {} });
      sendJson(res, 200, result);
      return;
    }

    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
  } catch (err) {
    console.error(err);
    sendJson(res, 500, { error: { message: err instanceof Error ? err.message : String(err) } });
  }
});

server.listen(PORT, () => {
  const environment = process.env.GETRAK_MCP_ENVIRONMENT || "homologation";
  console.log(`Getrak Core MCP — console de teste em http://localhost:${PORT}`);
  console.log(`Ambiente MCP ativo: ${environment}${environment === "production" ? " — ATENÇÃO: chamadas reais de produção" : ""}`);
});
