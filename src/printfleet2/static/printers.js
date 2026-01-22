document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("printerForm");
  const notice = document.getElementById("printerNotice");
  const submitBtn = document.getElementById("printerSubmit");
  const resetBtn = document.getElementById("printerReset");
  const refreshBtn = document.getElementById("printerRefresh");
  const exportBtn = document.getElementById("printerExport");
  const importBtn = document.getElementById("printerImport");
  const importFile = document.getElementById("printerImportFile");
  const netScanBtn = document.getElementById("netScanButton");
  const netScanExportBtn = document.getElementById("netScanExport");
  const netScanNotice = document.getElementById("netScanNotice");
  const netScanTable = document.getElementById("netScanTable");
  const netScanTimestamp = document.getElementById("netScanTimestamp");
  const groupSelect = document.getElementById("printerGroupId");
  const typeSelect = document.getElementById("printerType");
  const sortButtons = Array.from(document.querySelectorAll("[data-sort]"));
  const netSortButtons = Array.from(document.querySelectorAll("[data-net-sort]"));
  const tabButtons = Array.from(document.querySelectorAll("[data-printer-tab]"));
  const tabPanels = Array.from(document.querySelectorAll("[data-printer-panel]"));
  const netScanFilters = [
    { id: "netScanFilterElegoo", type: "elegoo-centurio-carbon" },
    { id: "netScanFilterNeptune", type: "elegoo-neptune" },
    { id: "netScanFilterMoonraker", type: "moonraker" },
    { id: "netScanFilterOctoPrint", type: "octoprint" },
    { id: "netScanFilterTasmota", type: "tasmota" },
  ];

  if (!form || !notice || !submitBtn || !resetBtn || !refreshBtn) {
    return;
  }

  function activateTab(targetId) {
    tabButtons.forEach((button) => {
      const isActive = button.dataset.printerTab === targetId;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-selected", isActive ? "true" : "false");
      button.tabIndex = isActive ? 0 : -1;
    });
    tabPanels.forEach((panel) => {
      const isActive = panel.id === targetId;
      panel.classList.toggle("is-active", isActive);
      panel.hidden = !isActive;
    });
  }

  if (tabButtons.length && tabPanels.length) {
    tabButtons.forEach((button) => {
      button.addEventListener("click", () => {
        activateTab(button.dataset.printerTab);
      });
    });
    const initialTab =
      tabButtons.find((button) => button.classList.contains("is-active"))?.dataset.printerTab ||
      tabButtons[0].dataset.printerTab;
    activateTab(initialTab);
  }

  function setNotice(message, type) {
    notice.textContent = message;
    notice.className = "notice " + (type || "");
    if (!message) {
      notice.className = "notice";
    }
  }

  function setNetScanNotice(message, type) {
    if (!netScanNotice) {
      return;
    }
    netScanNotice.textContent = message;
    netScanNotice.className = "notice " + (type || "");
    if (!message) {
      netScanNotice.className = "notice";
    }
  }

  function optionalValue(fieldId) {
    const field = document.getElementById(fieldId);
    if (!field) {
      return null;
    }
    const trimmed = field.value.trim();
    return trimmed ? trimmed : null;
  }

  function normalizeText(value) {
    if (typeof value !== "string") {
      return "";
    }
    return value.trim();
  }

  function optionalText(value) {
    if (typeof value !== "string") {
      return null;
    }
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  function normalizePrintCheckStatus(value, fallback = "clear") {
    if (value === null || value === undefined) {
      return fallback;
    }
    if (typeof value === "boolean") {
      return value ? "check" : "clear";
    }
    if (typeof value === "string") {
      const cleaned = value.trim().toLowerCase().replace(/\s+/g, "").replace(/_/g, "");
      if (cleaned === "check" || cleaned === "checkprinter") {
        return "check";
      }
      if (cleaned === "clear" || cleaned === "ok" || cleaned === "ready") {
        return "clear";
      }
    }
    return fallback;
  }

  function numericValue(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function parseImportHost(rawHost, rawPort, rawHttps) {
    const trimmed = normalizeText(rawHost);
    let host = trimmed;
    let port = Number.isFinite(Number(rawPort)) ? Number(rawPort) : null;
    let https = !!rawHttps;
    if (trimmed && /^https?:\/\//i.test(trimmed)) {
      try {
        const url = new URL(trimmed);
        host = url.hostname;
        if (url.port) {
          port = numericValue(url.port, port ?? 80);
        } else if (port === null) {
          port = url.protocol === "https:" ? 443 : 80;
        }
        https = url.protocol === "https:";
      } catch (error) {
        host = trimmed.replace(/^https?:\/\//i, "").split("/")[0];
      }
    } else if (trimmed && trimmed.includes("/")) {
      host = trimmed.split("/")[0];
    }
    if (port === null) {
      port = 80;
    }
    return { host, port, https };
  }

  function buildImportPayload(raw) {
    if (!raw || typeof raw !== "object") {
      return null;
    }
    const name = normalizeText(raw.name);
    const backend = normalizeText(raw.backend);
    const hostInfo = parseImportHost(raw.host, raw.port, raw.https);
    const host = normalizeText(hostInfo.host);
    if (!name || !backend || !host) {
      return null;
    }
    return {
      name,
      backend,
      host,
      port: hostInfo.port,
      error_report_interval: numericValue(raw.error_report_interval, 30),
      location: optionalText(raw.location),
      printer_type: optionalText(raw.printer_type),
      notes: optionalText(raw.notes),
      token: optionalText(raw.token),
      api_key: optionalText(raw.api_key),
      tasmota_host: optionalText(raw.tasmota_host),
      tasmota_topic: optionalText(raw.tasmota_topic),
      group_id: Number.isFinite(Number(raw.group_id)) ? Number(raw.group_id) : null,
      https: hostInfo.https,
      enabled: raw.enabled !== undefined ? !!raw.enabled : true,
      scanning:
        raw.scanning !== undefined ? !!raw.scanning : raw.no_scanning !== undefined ? !raw.no_scanning : true,
      print_check_status: normalizePrintCheckStatus(raw.print_check_status),
    };
  }

  function normalizeKey(value) {
    if (typeof value !== "string") {
      return "";
    }
    return value.trim().toLowerCase();
  }

  function normalizeTypeValue(value) {
    if (typeof value !== "string") {
      return "";
    }
    return value.trim().toLowerCase();
  }

  function hostSortKey(value) {
    if (value === null || value === undefined) {
      return "2-";
    }
    const raw = String(value).trim().toLowerCase();
    if (!raw) {
      return "2-";
    }
    const match = raw.match(/^(\d{1,3}(?:\.\d{1,3}){3})(?::\d+)?$/);
    if (match) {
      const octets = match[1]
        .split(".")
        .map((part) => String(Math.min(255, Math.max(0, Number(part) || 0))).padStart(3, "0"))
        .join(".");
      return `0-${octets}`;
    }
    return `1-${raw}`;
  }

  function buildHostKey(payload) {
    if (!payload) {
      return "";
    }
    return [
      normalizeKey(payload.backend),
      normalizeKey(payload.host),
      String(numericValue(payload.port, 80)),
    ].join("|");
  }

  function buildExportFileName() {
    const now = new Date();
    const pad = (value) => String(value).padStart(2, "0");
    return (
      "printfleet_printers_" +
      now.getFullYear() +
      pad(now.getMonth() + 1) +
      pad(now.getDate()) +
      "_" +
      pad(now.getHours()) +
      pad(now.getMinutes()) +
      pad(now.getSeconds()) +
      ".json"
    );
  }

  function downloadJson(filename, payload) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function buildNetScanExportFileName() {
    const now = new Date();
    const pad = (value) => String(value).padStart(2, "0");
    return (
      "printfleet_net_scan_" +
      now.getFullYear() +
      pad(now.getMonth() + 1) +
      pad(now.getDate()) +
      "_" +
      pad(now.getHours()) +
      pad(now.getMinutes()) +
      pad(now.getSeconds()) +
      ".json"
    );
  }

  function formatDateTime(value) {
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
      return "";
    }
    return value.toLocaleString("de-DE");
  }

  function updateNetScanTimestamp(date) {
    if (!netScanTimestamp) {
      return;
    }
    if (!date) {
      netScanTimestamp.textContent = "No scan run yet.";
      return;
    }
    netScanTimestamp.textContent = `Last scan: ${formatDateTime(date)}`;
  }

  let lastNetScan = { items: [], scannedAt: null };

  let printersCache = [];
  let sortState = { key: null, direction: "asc" };
  let netSortState = { key: null, direction: "asc" };
  let plugEnergyCache = new Map();
  let plugEnergyLoaded = false;
  let printerGroupsCache = [];
  let printerTypesCache = [];
  let tasmotaTooltip = null;
  let tasmotaTooltipAnchor = null;
  let tasmotaTooltipPointer = { x: 0, y: 0 };

  function sortValue(printer, key) {
    if (!printer) {
      return "";
    }
    switch (key) {
      case "name":
        return normalizeKey(printer.name);
      case "backend":
        return normalizeKey(printer.backend);
      case "host":
        return hostSortKey(printer.host);
      case "enabled":
        return printer.enabled ? 1 : 0;
      case "scanning":
        return printer.scanning ? 1 : 0;
      case "tasmota_host":
        return hostSortKey(printer.tasmota_host);
      default:
        return "";
    }
  }

  function sortedPrinters(items) {
    if (!sortState.key) {
      return items.slice();
    }
    return items
      .map((printer, index) => ({ printer, index }))
      .sort((left, right) => {
        const a = sortValue(left.printer, sortState.key);
        const b = sortValue(right.printer, sortState.key);
        if (a < b) {
          return sortState.direction === "asc" ? -1 : 1;
        }
        if (a > b) {
          return sortState.direction === "asc" ? 1 : -1;
        }
        return left.index - right.index;
      })
      .map((entry) => entry.printer);
  }

  function updateSortButtons() {
    sortButtons.forEach((button) => {
      const key = button.dataset.sort;
      if (sortState.key === key) {
        button.dataset.direction = sortState.direction;
      } else {
        delete button.dataset.direction;
      }
    });
  }

  function formatPowerValue(value) {
    if (!Number.isFinite(value)) {
      return null;
    }
    return value.toLocaleString("de-DE", { maximumFractionDigits: 1 });
  }

  function formatEnergyValue(value) {
    if (!Number.isFinite(value)) {
      return null;
    }
    return Math.round(value).toLocaleString("de-DE");
  }

  function formatPrintHours(seconds) {
    const totalSeconds = Number(seconds);
    if (!Number.isFinite(totalSeconds) || totalSeconds < 0) {
      return "";
    }
    const hours = totalSeconds / 3600;
    return `${hours.toFixed(1)} h`;
  }

  function ensureTasmotaTooltip() {
    if (tasmotaTooltip) {
      return;
    }
    tasmotaTooltip = document.createElement("div");
    tasmotaTooltip.className = "tasmota-tooltip";
    document.body.appendChild(tasmotaTooltip);
  }

  function updateTasmotaTooltipPosition(pointer) {
    if (!tasmotaTooltip) {
      return;
    }
    const padding = 12;
    const viewportPadding = 8;
    const rect = tasmotaTooltip.getBoundingClientRect();
    let x = pointer.x + padding;
    let y = pointer.y + padding;
    if (x + rect.width > window.innerWidth - viewportPadding) {
      x = window.innerWidth - rect.width - viewportPadding;
    }
    if (y + rect.height > window.innerHeight - viewportPadding) {
      y = window.innerHeight - rect.height - viewportPadding;
    }
    tasmotaTooltip.style.left = `${Math.max(viewportPadding, x)}px`;
    tasmotaTooltip.style.top = `${Math.max(viewportPadding, y)}px`;
  }

  function showTasmotaTooltip(element, pointer) {
    ensureTasmotaTooltip();
    const text = element.dataset.tasmotaHint || "";
    if (!text) {
      hideTasmotaTooltip();
      return;
    }
    tasmotaTooltip.textContent = text;
    tasmotaTooltip.classList.add("is-visible");
    tasmotaTooltipAnchor = element;
    tasmotaTooltipPointer = pointer;
    updateTasmotaTooltipPosition(pointer);
  }

  function hideTasmotaTooltip() {
    if (!tasmotaTooltip) {
      return;
    }
    tasmotaTooltip.classList.remove("is-visible");
    tasmotaTooltip.textContent = "";
    tasmotaTooltipAnchor = null;
  }

  function refreshTasmotaTooltip() {
    if (!tasmotaTooltip || !tasmotaTooltipAnchor) {
      return;
    }
    const text = tasmotaTooltipAnchor.dataset.tasmotaHint || "";
    if (!text) {
      hideTasmotaTooltip();
      return;
    }
    tasmotaTooltip.textContent = text;
    updateTasmotaTooltipPosition(tasmotaTooltipPointer);
  }

  function buildTasmotaHint(printerId) {
    if (!plugEnergyLoaded) {
      return "Energiedaten werden geladen...";
    }
    const entry = plugEnergyCache.get(printerId);
    if (!entry || entry.error) {
      return "Energiedaten nicht verfuegbar";
    }
    const lines = [];
    const power = formatPowerValue(entry.power_w);
    if (power !== null) {
      lines.push(`Leistung aktuell: ${power} W`);
    }
    const today = formatEnergyValue(entry.today_wh);
    if (today !== null) {
      lines.push(`Heute: ${today} Wh`);
    }
    return lines.length ? lines.join("\n") : "Energiedaten nicht verfuegbar";
  }

  function applyTasmotaHints() {
    document.querySelectorAll("[data-tasmota-id]").forEach((element) => {
      const id = Number(element.dataset.tasmotaId);
      if (!Number.isFinite(id)) {
        return;
      }
      const hint = buildTasmotaHint(id);
      element.removeAttribute("title");
      element.dataset.tasmotaHint = hint;
      element.setAttribute("aria-label", hint);
      if (!element.dataset.tasmotaBound) {
        element.dataset.tasmotaBound = "true";
        element.addEventListener("mouseenter", (event) => {
          showTasmotaTooltip(element, { x: event.clientX, y: event.clientY });
        });
        element.addEventListener("mousemove", (event) => {
          tasmotaTooltipPointer = { x: event.clientX, y: event.clientY };
          updateTasmotaTooltipPosition(tasmotaTooltipPointer);
        });
        element.addEventListener("mouseleave", hideTasmotaTooltip);
      }
    });
    refreshTasmotaTooltip();
  }

  function renderGroupOptions(selectedId) {
    if (!groupSelect) {
      return;
    }
    const currentValue = selectedId !== undefined ? selectedId : groupSelect.value;
    const selectedType = normalizeTypeValue(typeSelect ? typeSelect.value : "");
    groupSelect.innerHTML = "";
    if (!selectedType) {
      const placeholderOption = document.createElement("option");
      placeholderOption.value = "";
      placeholderOption.textContent = "Select printer type first";
      groupSelect.appendChild(placeholderOption);
      groupSelect.value = "";
      groupSelect.disabled = true;
      return;
    }
    groupSelect.disabled = false;
    const emptyOption = document.createElement("option");
    emptyOption.value = "";
    emptyOption.textContent = "No group";
    groupSelect.appendChild(emptyOption);
    const filteredGroups = printerGroupsCache.filter((group) => {
      const groupType = normalizeTypeValue(group && group.printer_type);
      return groupType === selectedType;
    });
    filteredGroups.forEach((group) => {
      const option = document.createElement("option");
      option.value = String(group.id);
      option.textContent = group.name;
      groupSelect.appendChild(option);
    });
    let normalized = currentValue !== null && currentValue !== undefined ? String(currentValue) : "";
    if (normalized && !filteredGroups.some((group) => String(group.id) === normalized)) {
      normalized = "";
    }
    groupSelect.value = normalized;
  }

  function renderTypeOptions(selectedValue) {
    if (!typeSelect) {
      return;
    }
    const currentValue = selectedValue !== undefined ? selectedValue : typeSelect.value;
    typeSelect.innerHTML = "";
    const emptyOption = document.createElement("option");
    emptyOption.value = "";
    emptyOption.textContent = "No type";
    typeSelect.appendChild(emptyOption);
    printerTypesCache.forEach((printerType) => {
      const option = document.createElement("option");
      option.value = printerType.name;
      if (printerType.active === false) {
        option.disabled = true;
        option.textContent = `${printerType.name} (inactive)`;
      } else {
        option.textContent = printerType.name;
      }
      typeSelect.appendChild(option);
    });
    const normalized = currentValue !== null && currentValue !== undefined ? String(currentValue) : "";
    if (normalized && !typeSelect.querySelector(`option[value="${normalized}"]`)) {
      const option = document.createElement("option");
      option.value = normalized;
      option.textContent = `Unknown (${normalized})`;
      typeSelect.appendChild(option);
    }
    typeSelect.value = normalized;
  }

  async function loadPrinterTypes(selectedValue) {
    if (!typeSelect) {
      return;
    }
    try {
      const res = await fetch("/api/printer-types");
      if (!res.ok) {
        return;
      }
      const data = await res.json().catch(() => ({}));
      printerTypesCache = Array.isArray(data.items) ? data.items : [];
      renderTypeOptions(selectedValue);
    } catch (error) {
      // ignore type load failures
    }
  }

  async function loadPrinterGroups() {
    if (!groupSelect) {
      return;
    }
    try {
      const res = await fetch("/api/printer-groups");
      if (!res.ok) {
        return;
      }
      const data = await res.json().catch(() => ({}));
      printerGroupsCache = Array.isArray(data.items) ? data.items : [];
      renderGroupOptions();
    } catch (error) {
      // ignore group load failures
    }
  }

  function renderPrinterTable(items) {
    const table = document.getElementById("printerTable");
    table.innerHTML = "";
    if (!items.length) {
      table.innerHTML = "<tr><td colspan=\"8\" class=\"muted\">No printers loaded yet.</td></tr>";
      return;
    }
    items.forEach((printer) => {
      const scheme = printer.https ? "https" : "http";
      const port = Number(printer.port || 80);
      const defaultPort = (scheme === "https" && port === 443) || (scheme === "http" && port === 80);
      const hostPart = printer.host || "";
      const portPart = defaultPort ? "" : `:${port}`;
      const webUrl = hostPart ? `${scheme}://${hostPart}${portPart}` : "";
      const row = document.createElement("tr");
      const typeLabel = printer.printer_type || "-";
      const checkStatus = normalizePrintCheckStatus(printer.print_check_status);
      const statusHtml =
        checkStatus === "check"
          ? `<button class="printer-status status-warn printer-check-status" type="button" data-printer-id="${printer.id}">Check printer</button>`
          : `<span class="printer-status printer-status-clear">Clear</span>`;
      row.innerHTML = `
        <td><strong>${printer.name}</strong><br>${statusHtml}<br><span class="muted">${typeLabel}</span></td>
        <td>${printer.backend}</td>
        <td>${printer.host}</td>
        <td>${printer.enabled ? "Yes" : "No"}</td>
        <td>${printer.scanning ? "Yes" : "No"}</td>
        <td>${
          printer.tasmota_host
            ? `<span class="tasmota-host" data-tasmota-id="${printer.id}">${printer.tasmota_host}</span>`
            : "-"
        }</td>
        <td>${webUrl ? `<a class="btn small outline" href="${webUrl}" target="_blank" rel="noopener">Open</a>` : "-"}</td>
        <td>
          <button class="btn small" data-action="edit" type="button">Edit</button>
          <button class="btn small danger" data-action="delete" type="button">Delete</button>
        </td>
      `;
      const editBtn = row.querySelector('[data-action="edit"]');
      const deleteBtn = row.querySelector('[data-action="delete"]');
      const checkBtn = row.querySelector(".printer-check-status");
      if (editBtn) {
        editBtn.addEventListener("click", () => fillForm(printer));
      }
      if (deleteBtn) {
        deleteBtn.addEventListener("click", async () => {
          if (!confirm("Delete printer " + printer.name + "?")) return;
          const del = await fetch("/api/printers/" + printer.id, { method: "DELETE" });
          if (del.ok) {
            setNotice("Printer deleted.", "success");
            loadPrinters();
            clearForm({ keepNotice: true });
          } else {
            setNotice("Failed to delete printer.", "error");
          }
        });
      }
      if (checkBtn) {
        checkBtn.addEventListener("click", async () => {
          const confirmed = window.confirm(
            "Checkliste vor dem naechsten Druck:\n" +
              "- Druckbett frei und sauber\n" +
              "- Passendes Filament geladen\n" +
              "- G-Code Datei passt zum Druckermodell\n" +
              "- Achsen und Bauteile frei beweglich\n\n" +
              "Status auf Clear setzen?"
          );
          if (!confirmed) {
            return;
          }
          const res = await fetch("/api/printers/" + printer.id, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ print_check_status: "clear" }),
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            setNotice(data.error || "Failed to update printer status.", "error");
            return;
          }
          setNotice("Printer status cleared.", "success");
          loadPrinters();
        });
      }
      table.appendChild(row);
    });
    applyTasmotaHints();
  }

  function resolveNetScanType(device) {
    const raw = normalizeKey(device.type || device.label || "");
    if (!raw) {
      return "";
    }
    if (raw.includes("moonraker")) {
      return "moonraker";
    }
    if (raw.includes("octoprint")) {
      return "octoprint";
    }
    if (raw.includes("tasmota")) {
      return "tasmota";
    }
    if (raw.includes("neptune")) {
      return "elegoo-neptune";
    }
    if (raw.includes("elegoo") || raw.includes("centurio") || raw.includes("centauri")) {
      return "elegoo-centurio-carbon";
    }
    return raw;
  }

  function selectedNetScanTypes() {
    const selected = new Set();
    netScanFilters.forEach((filter) => {
      const field = document.getElementById(filter.id);
      if (field && field.checked) {
        selected.add(filter.type);
      }
    });
    if (!selected.size) {
      netScanFilters.forEach((filter) => selected.add(filter.type));
    }
    return selected;
  }

  function renderNetScanTable(items) {
    if (!netScanTable) {
      return;
    }
    const sortedItems = sortNetScanItems(items);
    netScanTable.innerHTML = "";
    if (!sortedItems.length) {
      netScanTable.innerHTML = "<tr><td colspan=\"5\" class=\"muted\">No devices found.</td></tr>";
      return;
    }
    sortedItems.forEach((device) => {
      const row = document.createElement("tr");
      const name = device.name ? device.name : "-";
      const url = device.url || "";
      row.innerHTML = `
        <td>${device.label || device.type || "-"}</td>
        <td>${device.host || "-"}</td>
        <td>${device.port || "-"}</td>
        <td>${name}</td>
        <td>${url ? `<a class="btn small outline" href="${url}" target="_blank" rel="noopener">Open</a>` : "-"}</td>
      `;
      netScanTable.appendChild(row);
    });
  }

  function netSortValue(device, key) {
    switch (key) {
      case "type":
        return normalizeKey(device.label || device.type);
      case "host":
        return hostSortKey(device.host);
      case "port":
        return Number(device.port || 0);
      case "name":
        return normalizeKey(device.name);
      default:
        return "";
    }
  }

  function sortNetScanItems(items) {
    if (!netSortState.key) {
      return items.slice();
    }
    return items
      .map((device, index) => ({ device, index }))
      .sort((left, right) => {
        const a = netSortValue(left.device, netSortState.key);
        const b = netSortValue(right.device, netSortState.key);
        if (a < b) {
          return netSortState.direction === "asc" ? -1 : 1;
        }
        if (a > b) {
          return netSortState.direction === "asc" ? 1 : -1;
        }
        return left.index - right.index;
      })
      .map((entry) => entry.device);
  }

  function updateNetSortButtons() {
    netSortButtons.forEach((button) => {
      const key = button.dataset.netSort;
      if (netSortState.key === key) {
        button.dataset.direction = netSortState.direction;
      } else {
        delete button.dataset.direction;
      }
    });
  }

  function applyNetScanFilters() {
    const items = Array.isArray(lastNetScan.items) ? lastNetScan.items : [];
    const selected = selectedNetScanTypes();
    const filtered = items.filter((device) => selected.has(resolveNetScanType(device)));
    renderNetScanTable(filtered);
    if (items.length) {
      setNetScanNotice(`Showing ${filtered.length} of ${items.length} device(s).`, "success");
    }
  }

  function formData() {
    const errorIntervalValue = Number(document.getElementById("printerErrorInterval").value || 30);
    const groupValue = groupSelect ? groupSelect.value : "";
    const parsedGroup = groupValue ? Number(groupValue) : null;
    return {
      name: document.getElementById("printerName").value.trim(),
      backend: document.getElementById("printerBackend").value,
      host: document.getElementById("printerHost").value.trim(),
      port: Number(document.getElementById("printerPort").value || 80),
      error_report_interval: errorIntervalValue,
      location: optionalValue("printerLocation"),
      printer_type: optionalValue("printerType"),
      notes: optionalValue("printerNotes"),
      token: optionalValue("printerToken"),
      api_key: optionalValue("printerApiKey"),
      tasmota_host: optionalValue("printerTasmotaHost"),
      tasmota_topic: optionalValue("printerTasmotaTopic"),
      https: document.getElementById("printerHttps").checked,
      enabled: document.getElementById("printerEnabled").checked,
      scanning: document.getElementById("printerScanning").checked,
      group_id: Number.isFinite(parsedGroup) ? parsedGroup : null,
    };
  }

  function fillForm(printer) {
    document.getElementById("printerId").value = printer.id;
    document.getElementById("printerName").value = printer.name || "";
    document.getElementById("printerBackend").value = printer.backend || "";
    document.getElementById("printerHost").value = printer.host || "";
    document.getElementById("printerPort").value = printer.port || 80;
    document.getElementById("printerErrorInterval").value =
      printer.error_report_interval !== null && printer.error_report_interval !== undefined
        ? printer.error_report_interval
        : 30;
    document.getElementById("printerLocation").value = printer.location || "";
    if (printerTypesCache.length) {
      renderTypeOptions(printer.printer_type || "");
    } else {
      loadPrinterTypes(printer.printer_type || "");
    }
    document.getElementById("printerNotes").value = printer.notes || "";
    const printHoursField = document.getElementById("printerPrintHours");
    if (printHoursField) {
      printHoursField.value = formatPrintHours(printer.print_time_total_seconds);
    }
    document.getElementById("printerToken").value = printer.token || "";
    document.getElementById("printerApiKey").value = printer.api_key || "";
    document.getElementById("printerTasmotaHost").value = printer.tasmota_host || "";
    document.getElementById("printerTasmotaTopic").value = printer.tasmota_topic || "";
    document.getElementById("printerHttps").checked = !!printer.https;
    document.getElementById("printerEnabled").checked = !!printer.enabled;
    document.getElementById("printerScanning").checked =
      printer.scanning !== undefined ? !!printer.scanning : !printer.no_scanning;
    if (groupSelect) {
      renderGroupOptions(printer.group_id);
    }
    submitBtn.textContent = "Save changes";
  }

  function clearForm(options) {
    const keepNotice = options && options.keepNotice;
    document.getElementById("printerId").value = "";
    document.getElementById("printerName").value = "";
    document.getElementById("printerBackend").value = "";
    document.getElementById("printerHost").value = "";
    document.getElementById("printerPort").value = 80;
    document.getElementById("printerErrorInterval").value = 30;
    document.getElementById("printerLocation").value = "";
    if (printerTypesCache.length) {
      renderTypeOptions("");
    } else {
      loadPrinterTypes("");
    }
    document.getElementById("printerNotes").value = "";
    const printHoursField = document.getElementById("printerPrintHours");
    if (printHoursField) {
      printHoursField.value = "";
    }
    document.getElementById("printerToken").value = "";
    document.getElementById("printerApiKey").value = "";
    document.getElementById("printerTasmotaHost").value = "";
    document.getElementById("printerTasmotaTopic").value = "";
    document.getElementById("printerHttps").checked = false;
    document.getElementById("printerEnabled").checked = true;
    document.getElementById("printerScanning").checked = true;
    if (groupSelect) {
      renderGroupOptions("");
    }
    submitBtn.textContent = "Create printer";
    if (!keepNotice) {
      setNotice("", "");
    }
  }

  async function loadPrinters() {
    await Promise.all([loadPrinterGroups(), loadPrinterTypes()]);
    const res = await fetch("/api/printers");
    const data = res.ok ? await res.json() : { items: [] };
    if (!res.ok) {
      setNotice("Failed to load printers.", "error");
    }
    printersCache = data.items || [];
    renderPrinterTable(sortedPrinters(printersCache));
    loadPlugEnergy();
  }

  async function loadPlugEnergy() {
    const hasTasmota = printersCache.some((printer) => printer.tasmota_host);
    plugEnergyCache = new Map();
    plugEnergyLoaded = false;
    applyTasmotaHints();
    if (!hasTasmota) {
      plugEnergyLoaded = true;
      applyTasmotaHints();
      return;
    }
    try {
      const res = await fetch("/api/printers/plug-energy", { cache: "no-store" });
      if (!res.ok) {
        throw new Error("plug-energy-failed");
      }
      const data = await res.json().catch(() => ({}));
      const items = Array.isArray(data.items) ? data.items : [];
      plugEnergyCache = new Map(
        items
          .filter((item) => item && Number.isFinite(Number(item.id)))
          .map((item) => [Number(item.id), item])
      );
    } catch (error) {
      plugEnergyCache = new Map();
    } finally {
      plugEnergyLoaded = true;
      applyTasmotaHints();
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = formData();
    if (!payload.name || !payload.backend || !payload.host) {
      setNotice("Name, backend, and host are required.", "error");
      return;
    }
    if (!Number.isFinite(payload.error_report_interval) || payload.error_report_interval < 0) {
      setNotice("Error interval must be 0 or higher.", "error");
      return;
    }
    const printerId = document.getElementById("printerId").value;
    const method = printerId ? "PATCH" : "POST";
    const url = printerId ? "/api/printers/" + printerId : "/api/printers";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      setNotice(printerId ? "Printer updated." : "Printer created.", "success");
      clearForm({ keepNotice: true });
      await loadPrinters();
    } else {
      const data = await res.json().catch(() => ({}));
      setNotice(data.error || "Request failed.", "error");
    }
  });

  resetBtn.addEventListener("click", () => clearForm());
  refreshBtn.addEventListener("click", loadPrinters);

  if (exportBtn) {
    exportBtn.addEventListener("click", async () => {
      exportBtn.disabled = true;
      setNotice("Preparing export...", "success");
      try {
        const res = await fetch("/api/printers");
        if (!res.ok) {
          throw new Error("export_failed");
        }
        const data = await res.json().catch(() => ({}));
        const items = data.items || [];
        downloadJson(buildExportFileName(), {
          exported_at: new Date().toISOString(),
          items,
        });
        setNotice(`Exported ${items.length} printer(s).`, "success");
      } catch (error) {
        setNotice("Failed to export printers.", "error");
      } finally {
        exportBtn.disabled = false;
      }
    });
  }

  if (importBtn && importFile) {
    importBtn.addEventListener("click", () => importFile.click());
    importFile.addEventListener("change", async () => {
      const file = importFile.files && importFile.files[0];
      importFile.value = "";
      if (!file) {
        return;
      }
      let payload;
      try {
        const text = await file.text();
        payload = JSON.parse(text);
      } catch (error) {
        setNotice("Invalid JSON file.", "error");
        return;
      }
      const items = Array.isArray(payload) ? payload : Array.isArray(payload.items) ? payload.items : null;
      if (!items) {
        setNotice("JSON must contain an array of printers.", "error");
        return;
      }
      if (!items.length) {
        setNotice("No printers found in JSON.", "error");
        return;
      }
      if (
        !confirm(
          `Import ${items.length} printer(s)? Only printers not already in the database will be imported.`
        )
      ) {
        return;
      }
      importBtn.disabled = true;
      setNotice(`Importing ${items.length} printer(s)...`, "success");
      let created = 0;
      let skippedInvalid = 0;
      let skippedExisting = 0;
      let failed = 0;
      const existingRes = await fetch("/api/printers");
      if (!existingRes.ok) {
        setNotice("Failed to load existing printers.", "error");
        importBtn.disabled = false;
        return;
      }
      const existingData = await existingRes.json().catch(() => ({}));
      const existingItems = existingData.items || [];
      const existingNameKeys = new Set(
        existingItems.map((printer) => normalizeKey(printer.name)).filter(Boolean)
      );
      const existingHostKeys = new Set(
        existingItems
          .map((printer) => {
            const hostInfo = parseImportHost(printer.host, printer.port, printer.https);
            return buildHostKey({
              backend: printer.backend,
              host: hostInfo.host,
              port: hostInfo.port,
            });
          })
          .filter(Boolean)
      );
      let groupIds = null;
      try {
        const groupRes = await fetch("/api/printer-groups");
        if (groupRes.ok) {
          const groupData = await groupRes.json().catch(() => ({}));
          const groups = groupData.items || [];
          groupIds = new Set(
            groups.map((group) => Number(group.id)).filter((id) => Number.isFinite(id))
          );
        }
      } catch (error) {
        groupIds = null;
      }
      for (const raw of items) {
        const data = buildImportPayload(raw);
        if (!data) {
          skippedInvalid += 1;
          continue;
        }
        if (
          groupIds &&
          data.group_id !== null &&
          data.group_id !== undefined &&
          !groupIds.has(Number(data.group_id))
        ) {
          data.group_id = null;
        }
        const nameKey = normalizeKey(data.name);
        const hostKey = buildHostKey(data);
        if ((nameKey && existingNameKeys.has(nameKey)) || (hostKey && existingHostKeys.has(hostKey))) {
          skippedExisting += 1;
          continue;
        }
        try {
          const res = await fetch("/api/printers", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
          });
          if (res.ok) {
            created += 1;
            if (nameKey) {
              existingNameKeys.add(nameKey);
            }
            if (hostKey) {
              existingHostKeys.add(hostKey);
            }
          } else {
            const errorData = await res.json().catch(() => ({}));
            const errorCode = errorData?.error || errorData?.code;
            if (
              data.group_id !== null &&
              data.group_id !== undefined &&
              (errorCode === "invalid_group_id" || errorCode === "group_not_found")
            ) {
              const retryPayload = { ...data, group_id: null };
              const retryRes = await fetch("/api/printers", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(retryPayload),
              });
              if (retryRes.ok) {
                created += 1;
                if (nameKey) {
                  existingNameKeys.add(nameKey);
                }
                if (hostKey) {
                  existingHostKeys.add(hostKey);
                }
                continue;
              }
            }
            failed += 1;
          }
        } catch (error) {
          failed += 1;
        }
      }
      if (failed) {
        setNotice(
          `Import complete: ${created} created, ${skippedExisting} existing, ${skippedInvalid} invalid, ${failed} failed.`,
          "error"
        );
      } else {
        setNotice(
          `Import complete: ${created} created, ${skippedExisting} existing, ${skippedInvalid} invalid.`,
          "success"
        );
      }
      importBtn.disabled = false;
      loadPrinters();
    });
  }

  if (netScanBtn && netScanTable) {
    netScanBtn.addEventListener("click", async () => {
      netScanBtn.disabled = true;
      setNetScanNotice("Scanning network...", "success");
      netScanTable.innerHTML = "<tr><td colspan=\"5\" class=\"muted\">Scanning...</td></tr>";
      try {
        const res = await fetch("/api/net-scan", { method: "POST" });
        if (!res.ok) {
          setNetScanNotice("Network scan failed.", "error");
          netScanTable.innerHTML = "<tr><td colspan=\"5\" class=\"muted\">Scan failed.</td></tr>";
          return;
        }
        const data = await res.json().catch(() => ({}));
        const items = data.items || [];
        const scannedAt = data.scanned_at ? new Date(data.scanned_at) : new Date();
        lastNetScan = { items, scannedAt };
        updateNetScanTimestamp(scannedAt);
        if (!items.length) {
          renderNetScanTable([]);
          setNetScanNotice("No devices found.", "success");
          return;
        }
        applyNetScanFilters();
      } catch (error) {
        setNetScanNotice("Network scan failed.", "error");
        netScanTable.innerHTML = "<tr><td colspan=\"5\" class=\"muted\">Scan failed.</td></tr>";
      } finally {
        netScanBtn.disabled = false;
      }
    });
  }

  if (netScanExportBtn) {
    netScanExportBtn.addEventListener("click", () => {
      if (!lastNetScan.scannedAt) {
        setNetScanNotice("No scan data to export yet.", "error");
        return;
      }
      const selected = selectedNetScanTypes();
      const items = (lastNetScan.items || []).filter((device) => selected.has(resolveNetScanType(device)));
      downloadJson(buildNetScanExportFileName(), {
        scanned_at: lastNetScan.scannedAt.toISOString(),
        scanned_at_local: formatDateTime(lastNetScan.scannedAt),
        filters: Array.from(selected),
        items,
      });
      setNetScanNotice("Network scan export started.", "success");
    });
  }

  netScanFilters.forEach((filter) => {
    const field = document.getElementById(filter.id);
    if (!field) {
      return;
    }
    field.addEventListener("change", () => {
      if (!lastNetScan.items.length) {
        return;
      }
      applyNetScanFilters();
    });
  });

  netSortButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.netSort;
      if (!key) {
        return;
      }
      if (netSortState.key === key) {
        netSortState.direction = netSortState.direction === "asc" ? "desc" : "asc";
      } else {
        netSortState = { key, direction: "asc" };
      }
      updateNetSortButtons();
      applyNetScanFilters();
    });
  });

  sortButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.sort;
      if (!key) {
        return;
      }
      if (sortState.key === key) {
        sortState.direction = sortState.direction === "asc" ? "desc" : "asc";
      } else {
        sortState = { key, direction: "asc" };
      }
      updateSortButtons();
      renderPrinterTable(sortedPrinters(printersCache));
    });
  });

  if (typeSelect && groupSelect) {
    typeSelect.addEventListener("change", () => {
      renderGroupOptions();
    });
  }

  loadPrinters();
  updateSortButtons();
  updateNetSortButtons();
});
