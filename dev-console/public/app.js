let allTools = [];
let selectedTool = null;

const toolListEl = document.getElementById("tool-list");
const toolFilterEl = document.getElementById("tool-filter");
const emptyStateEl = document.getElementById("empty-state");
const toolDetailEl = document.getElementById("tool-detail");
const toolNameEl = document.getElementById("tool-name");
const toolDescriptionEl = document.getElementById("tool-description");
const toolFormEl = document.getElementById("tool-form");
const callButtonEl = document.getElementById("call-button");
const resultPanelEl = document.getElementById("result-panel");
const resultOutputEl = document.getElementById("result-output");

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

async function loadEnvironmentBadge() {
  const badge = document.getElementById("env-badge");
  try {
    const res = await fetch("/api/environment");
    const { environment } = await res.json();
    badge.textContent = `ambiente: ${environment}`;
    badge.classList.toggle("production", environment === "production");
  } catch {
    badge.textContent = "ambiente: desconhecido (falha ao consultar)";
  }
}

async function loadTools() {
  toolListEl.innerHTML = "<li>Carregando…</li>";
  try {
    const res = await fetch("/api/tools");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    allTools = (data.tools || []).slice().sort((a, b) => a.name.localeCompare(b.name));
    renderToolList(allTools);
  } catch (err) {
    toolListEl.innerHTML = `<li>Erro ao carregar tools: ${escapeHtml(err.message)}. O servidor MCP ainda está subindo (spawn via tsx pode levar alguns segundos) — tente recarregar.</li>`;
  }
}

function renderToolList(tools) {
  toolListEl.innerHTML = "";
  for (const tool of tools) {
    const li = document.createElement("li");
    li.textContent = tool.name;
    li.dataset.name = tool.name;
    if (selectedTool && selectedTool.name === tool.name) li.classList.add("selected");
    li.addEventListener("click", () => selectTool(tool));
    toolListEl.appendChild(li);
  }
  if (tools.length === 0) {
    toolListEl.innerHTML = "<li>Nenhuma tool corresponde ao filtro.</li>";
  }
}

function selectTool(tool) {
  selectedTool = tool;
  renderToolList(filterTools(toolFilterEl.value));

  emptyStateEl.hidden = true;
  toolDetailEl.hidden = false;
  toolNameEl.textContent = tool.name;
  toolDescriptionEl.textContent = tool.description || "(sem descrição)";
  resultPanelEl.hidden = true;
  resultOutputEl.textContent = "";

  renderForm(tool.inputSchema || { properties: {}, required: [] });
}

function renderForm(schema) {
  toolFormEl.innerHTML = "";
  const properties = schema.properties || {};
  const required = new Set(schema.required || []);

  const names = Object.keys(properties);
  if (names.length === 0) {
    toolFormEl.innerHTML = "<p><em>Esta tool não recebe parâmetros.</em></p>";
    return;
  }

  for (const name of names) {
    const propSchema = properties[name] || {};
    const isRequired = required.has(name);
    toolFormEl.appendChild(buildField(name, propSchema, isRequired));
  }
}

function buildField(name, propSchema, isRequired) {
  const wrapper = document.createElement("label");
  const labelText = `${name}${isRequired ? " *" : ""}`;

  if (propSchema.type === "boolean") {
    wrapper.innerHTML = `<input type="checkbox" name="${escapeHtml(name)}" data-kind="boolean" /> ${escapeHtml(labelText)}`;
    appendHint(wrapper, propSchema);
    return wrapper;
  }

  if (Array.isArray(propSchema.enum)) {
    const options = propSchema.enum
      .map((v) => `<option value="${escapeHtml(String(v))}">${escapeHtml(String(v))}</option>`)
      .join("");
    wrapper.innerHTML = `${escapeHtml(labelText)}<select name="${escapeHtml(name)}" data-kind="string" ${isRequired ? "required" : ""}>
      <option value="">-- não informar --</option>${options}
    </select>`;
    appendHint(wrapper, propSchema);
    return wrapper;
  }

  if (propSchema.type === "array") {
    const itemHint = propSchema.items && Array.isArray(propSchema.items.enum) ? ` Valores aceitos: ${propSchema.items.enum.join(", ")}.` : "";
    wrapper.innerHTML = `${escapeHtml(labelText)}<input type="text" name="${escapeHtml(name)}" data-kind="array" placeholder="valor1, valor2" />`;
    appendHint(wrapper, propSchema, `Lista separada por vírgulas.${itemHint}`);
    return wrapper;
  }

  if (propSchema.type === "integer" || propSchema.type === "number") {
    wrapper.innerHTML = `${escapeHtml(labelText)}<input type="number" name="${escapeHtml(name)}" data-kind="number" ${isRequired ? "required" : ""} />`;
    appendHint(wrapper, propSchema);
    return wrapper;
  }

  wrapper.innerHTML = `${escapeHtml(labelText)}<input type="text" name="${escapeHtml(name)}" data-kind="string" ${isRequired ? "required" : ""} />`;
  appendHint(wrapper, propSchema);
  return wrapper;
}

function appendHint(wrapper, propSchema, extra) {
  const parts = [];
  if (propSchema.description) parts.push(propSchema.description);
  if (extra) parts.push(extra);
  if (parts.length === 0) return;
  const hint = document.createElement("span");
  hint.className = "field-hint";
  hint.textContent = parts.join(" ");
  wrapper.appendChild(hint);
}

function collectArguments() {
  const args = {};
  const elements = toolFormEl.elements;
  for (const el of elements) {
    if (!el.name) continue;
    const kind = el.dataset.kind;
    if (kind === "boolean") {
      if (el.checked) args[el.name] = true;
      continue;
    }
    const raw = el.value;
    if (raw === "") continue;
    if (kind === "array") {
      args[el.name] = raw.split(",").map((s) => s.trim()).filter(Boolean);
    } else if (kind === "number") {
      args[el.name] = Number(raw);
    } else {
      args[el.name] = raw;
    }
  }
  return args;
}

function filterTools(query) {
  const q = query.trim().toLowerCase();
  if (!q) return allTools;
  return allTools.filter((t) => t.name.toLowerCase().includes(q) || (t.description || "").toLowerCase().includes(q));
}

toolFilterEl.addEventListener("input", () => renderToolList(filterTools(toolFilterEl.value)));

toolFormEl.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!selectedTool) return;

  const args = collectArguments();
  callButtonEl.disabled = true;
  callButtonEl.textContent = "Executando…";
  resultPanelEl.hidden = false;
  resultPanelEl.classList.remove("success", "error");
  resultOutputEl.textContent = "Chamando a tool…";

  try {
    const res = await fetch("/api/call", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: selectedTool.name, arguments: args }),
    });
    const body = await res.json();

    if (!res.ok) {
      resultPanelEl.classList.add("error");
      resultOutputEl.textContent = JSON.stringify(body, null, 2);
      return;
    }

    const text = body.content?.[0]?.text ?? JSON.stringify(body, null, 2);
    let pretty = text;
    try {
      pretty = JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      // texto não era JSON — mostra como veio
    }

    resultPanelEl.classList.add(body.isError ? "error" : "success");
    resultOutputEl.textContent = pretty;
  } catch (err) {
    resultPanelEl.classList.add("error");
    resultOutputEl.textContent = `Falha de rede/console: ${err.message}`;
  } finally {
    callButtonEl.disabled = false;
    callButtonEl.textContent = "Executar";
  }
});

loadEnvironmentBadge();
loadTools();
