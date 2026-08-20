/**
 * Mapeamento estático nome-da-tool -> domínio do catálogo interno do MCP.
 *
 * O protocolo MCP padrão (`tools/list`) só expõe `name`/`description`/
 * `inputSchema` — não expõe o domínio/catálogo interno (`foundation/catalog/
 * tool-catalog.ts`), que é uma organização do lado do servidor, não do
 * protocolo. Por isso este console (ferramenta de desenvolvimento local, não
 * parte do produto) mantém esta tabela separadamente, espelhando o campo
 * `domain` de cada `catalogEntry` no código-fonte real de cada tool
 * (`src/domain/<domínio>/<tool>.ts`).
 *
 * MANUTENÇÃO: ao adicionar uma nova tool ao servidor, adicione a entrada
 * correspondente aqui também — não há verificação automática de
 * sincronismo. Uma tool ausente deste mapa ainda aparece no console (grupo
 * "Outras / não mapeadas"), nunca é ocultada silenciosamente.
 */
const TOOL_DOMAIN = {
  // Epic 2 — Veículos (oauth2ClientCredentials/Integracao)
  search_vehicles: "vehicles",
  get_vehicle_category: "vehicles",
  get_vehicle_client_link: "vehicles",
  get_vehicle_subclient_link: "vehicles",
  get_suspended_vehicles: "vehicles",
  // Epic 3 — Localização (oauth2Password/PublicoCliente)
  get_vehicle_current_location: "locations",
  get_vehicle_location_history: "locations",
  get_vehicle_paths: "locations",
  get_vehicle_movements_and_stops: "locations",
  get_vehicle_inputs_report: "locations",
  get_offline_treatments: "locations",
  get_offline_treatment_history: "locations",
  // Epic 4 — Equipamentos (oauth2ClientCredentials/Integracao)
  search_equipments: "equipments",
  get_equipment_bench_position: "equipments",
  // Epic 5 — Ordens de Serviço (oauth2ClientCredentials/Integracao)
  get_work_order_details: "work_orders",
  get_work_order_tests: "work_orders",
  get_work_order_tests_definition: "work_orders",
  get_work_order_report: "work_orders",
  // Epic 9 — Accounts (oauth2ClientCredentials/Integracao)
  search_clients: "accounts",
  search_subclients: "accounts",
  get_user_profiles: "accounts",
  get_centrals: "accounts",
  // Epic 10 — Accessories/Integrations/Perimeters (oauth2Password/GetrakWeb)
  search_accessories: "accessories",
  search_accessory_categories: "accessories",
  get_accessories_summary: "accessories",
  search_central_integrations: "integrations",
  search_geofences: "perimeters",
  search_perimeter_categories: "perimeters",
  search_reference_points: "perimeters",
  // Epic 16 — Web Users (oauth2Password/GetrakWeb)
  get_user_details: "web_users",
  search_web_users: "web_users",
  get_current_user: "web_users",
  // Epic 17 — Web Vehicles (oauth2Password/GetrakWeb)
  search_web_vehicles: "web_vehicles",
  get_vehicle_by_equipment: "web_vehicles",
  get_vehicle_equipment_history: "web_vehicles",
  get_vehicle_by_plate: "web_vehicles",
  get_vehicle_status: "web_vehicles",
  search_vehicles_status: "web_vehicles",
  // Epic 18 — Notifications (oauth2Password/GetrakWeb)
  search_messages: "notifications",
  get_messages_analytics: "notifications",
  // Epic 19 — Operations (oauth2Password/GetrakWeb)
  search_operations: "operations",
  // Epic 13 — Reports (oauth2Password/GetrakWeb)
  search_reports: "reports",
  get_reports_summary: "reports",
  // Epic 21 — Equipments, Getrak Web (oauth2Password/GetrakWeb)
  search_web_equipments: "web_equipments",
  get_web_equipment_details: "web_equipments",
  search_equipment_devices: "web_equipments",
  get_equipments_summary: "web_equipments",
  search_equipment_carriers: "web_equipments",
  get_inventory_summary: "web_equipments",
  search_inventory: "web_equipments",
  search_equipment_tags: "web_equipments",
  get_equipment_tag_details: "web_equipments",
  search_device_models: "web_equipments",
  search_equipment_import_requests: "web_equipments",
  get_equipment_import_items: "web_equipments",
  get_equipment_import_summary: "web_equipments",
  // Epic 15 — Clients, Getrak Web (oauth2Password/GetrakWeb)
  search_web_clients: "web_clients",
  get_clients_summary: "web_clients",
  get_subclients_summary: "web_clients",
  search_entity_import_requests: "web_clients",
  get_entity_import_details: "web_clients",
  get_entity_import_items: "web_clients",
  // Epic 14 — Maintenance, Getrak Web (oauth2Password/GetrakWeb)
  search_fuel_supplies: "maintenance",
  get_fuel_supply_summary: "maintenance",
  get_fuel_supply_details: "maintenance",
  get_fuel_supply_attachments: "maintenance",
  search_maintenance_services: "maintenance",
  get_maintenance_services_summary: "maintenance",
  search_maintenances: "maintenance",
  get_maintenances_summary: "maintenance",
  get_maintenance_details: "maintenance",
  get_maintenance_attachments: "maintenance",
};

/**
 * Metadados de exibição por domínio: rótulo amigável e o escopo/esquema de
 * autenticação real (CLAUDE.md Seção 6 / `x-tagGroups` do openapi.json:
 * Public, Integration, Getrak Web) usado pelas tools daquele domínio.
 * Fonte: comentário de cabeçalho de cada `domain/<domínio>/shared.ts`.
 */
const CATEGORY_META = {
  vehicles: { label: "Vehicles", scope: "Integration", scopeClass: "integration" },
  locations: { label: "Locations", scope: "Public", scopeClass: "public" },
  equipments: { label: "Equipments", scope: "Integration", scopeClass: "integration" },
  work_orders: { label: "Work Orders", scope: "Integration", scopeClass: "integration" },
  accounts: { label: "Accounts", scope: "Integration", scopeClass: "integration" },
  accessories: { label: "Accessories", scope: "Getrak Web", scopeClass: "getrakweb" },
  integrations: { label: "Central Integrations", scope: "Getrak Web", scopeClass: "getrakweb" },
  perimeters: { label: "Perimeters", scope: "Getrak Web", scopeClass: "getrakweb" },
  web_users: { label: "Users", scope: "Getrak Web", scopeClass: "getrakweb" },
  web_vehicles: { label: "Vehicles", scope: "Getrak Web", scopeClass: "getrakweb" },
  notifications: { label: "Notifications", scope: "Getrak Web", scopeClass: "getrakweb" },
  operations: { label: "Operations", scope: "Getrak Web", scopeClass: "getrakweb" },
  reports: { label: "Reports", scope: "Getrak Web", scopeClass: "getrakweb" },
  web_equipments: { label: "Equipments", scope: "Getrak Web", scopeClass: "getrakweb" },
  web_clients: { label: "Clients", scope: "Getrak Web", scopeClass: "getrakweb" },
  maintenance: { label: "Maintenance", scope: "Getrak Web", scopeClass: "getrakweb" },
  uncategorized: { label: "Outras / não mapeadas", scope: "desconhecido", scopeClass: "unknown" },
};

function domainOf(toolName) {
  return TOOL_DOMAIN[toolName] || "uncategorized";
}

let allTools = [];
let selectedTool = null;
let selectedCategory = null; // null = mostrando a lista de categorias

const toolListEl = document.getElementById("tool-list");
const toolFilterEl = document.getElementById("tool-filter");
const breadcrumbEl = document.getElementById("breadcrumb");
const breadcrumbScopeEl = document.getElementById("breadcrumb-scope");
const backToCategoriesEl = document.getElementById("back-to-categories");
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
    render();
  } catch (err) {
    toolListEl.innerHTML = `<li>Erro ao carregar tools: ${escapeHtml(err.message)}. O servidor MCP ainda está subindo (spawn via tsx pode levar alguns segundos) — tente recarregar.</li>`;
  }
}

/** Agrupa `allTools` por domínio, retornando um Map<domain, tool[]> ordenado por rótulo de categoria. */
function groupByCategory(tools) {
  const groups = new Map();
  for (const tool of tools) {
    const domain = domainOf(tool.name);
    if (!groups.has(domain)) groups.set(domain, []);
    groups.get(domain).push(tool);
  }
  return new Map(
    [...groups.entries()].sort((a, b) => {
      const labelA = (CATEGORY_META[a[0]] || CATEGORY_META.uncategorized).label;
      const labelB = (CATEGORY_META[b[0]] || CATEGORY_META.uncategorized).label;
      return labelA.localeCompare(labelB);
    }),
  );
}

function scopeBadgeHtml(scopeClass, scope) {
  return `<span class="scope-badge scope-${scopeClass}">${escapeHtml(scope)}</span>`;
}

/** Decide o que renderizar na lista à esquerda: categorias, tools de uma categoria, ou resultado de busca global. */
function render() {
  const query = toolFilterEl.value.trim().toLowerCase();

  if (query) {
    renderSearchResults(query);
    return;
  }

  if (selectedCategory) {
    renderCategoryTools(selectedCategory);
    return;
  }

  renderCategoryList();
}

function renderCategoryList() {
  breadcrumbEl.hidden = true;
  const groups = groupByCategory(allTools);
  toolListEl.innerHTML = "";
  toolListEl.classList.add("category-view");

  for (const [domain, tools] of groups) {
    const meta = CATEGORY_META[domain] || CATEGORY_META.uncategorized;
    const li = document.createElement("li");
    li.className = "category-row";
    li.innerHTML = `
      <div class="category-row-main">
        <span class="category-label">${escapeHtml(meta.label)}</span>
        <span class="category-count">${tools.length} tool${tools.length === 1 ? "" : "s"}</span>
      </div>
      ${scopeBadgeHtml(meta.scopeClass, meta.scope)}
    `;
    li.addEventListener("click", () => {
      selectedCategory = domain;
      render();
    });
    toolListEl.appendChild(li);
  }

  if (groups.size === 0) {
    toolListEl.innerHTML = "<li>Nenhuma tool carregada.</li>";
  }
}

function renderCategoryTools(domain) {
  const meta = CATEGORY_META[domain] || CATEGORY_META.uncategorized;
  breadcrumbEl.hidden = false;
  breadcrumbScopeEl.innerHTML = `<strong>${escapeHtml(meta.label)}</strong> ${scopeBadgeHtml(meta.scopeClass, meta.scope)}`;
  toolListEl.classList.remove("category-view");

  const tools = allTools.filter((t) => domainOf(t.name) === domain);
  toolListEl.innerHTML = "";
  for (const tool of tools) {
    toolListEl.appendChild(buildToolListItem(tool));
  }
  if (tools.length === 0) {
    toolListEl.innerHTML = "<li>Nenhuma tool nesta categoria.</li>";
  }
}

function renderSearchResults(query) {
  breadcrumbEl.hidden = true;
  toolListEl.classList.remove("category-view");

  const matches = allTools.filter(
    (t) => t.name.toLowerCase().includes(query) || (t.description || "").toLowerCase().includes(query),
  );
  toolListEl.innerHTML = "";
  for (const tool of matches) {
    const meta = CATEGORY_META[domainOf(tool.name)] || CATEGORY_META.uncategorized;
    const li = buildToolListItem(tool);
    const tag = document.createElement("span");
    tag.className = "tool-category-tag";
    tag.textContent = meta.label;
    li.appendChild(tag);
    toolListEl.appendChild(li);
  }
  if (matches.length === 0) {
    toolListEl.innerHTML = "<li>Nenhuma tool corresponde ao filtro.</li>";
  }
}

function buildToolListItem(tool) {
  const li = document.createElement("li");
  li.textContent = tool.name;
  li.dataset.name = tool.name;
  if (selectedTool && selectedTool.name === tool.name) li.classList.add("selected");
  li.addEventListener("click", () => selectTool(tool));
  return li;
}

backToCategoriesEl.addEventListener("click", () => {
  selectedCategory = null;
  render();
});

function selectTool(tool) {
  selectedTool = tool;
  render();

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

toolFilterEl.addEventListener("input", render);

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
