document.addEventListener("DOMContentLoaded", () => {
  const tableBody = document.getElementById("printerJustTable");
  if (!tableBody) {
    return;
  }

  const sortButtons = Array.from(document.querySelectorAll("[data-sort]"));
  const notice = document.getElementById("printerJustNotice");
  let sortState = { key: null, direction: "asc" };
  let pollIntervalId = null;
  let pollIntervalMs = 5000;
  let cachedPrinters = [];
  let cachedStatuses = [];
  let cachedGroups = [];
  let cachedTypes = [];
  const uploadBackends = new Set(["octoprint", "moonraker"]);

  function setNotice(message, type) {
    if (!notice) {
      return;
    }
    notice.textContent = message;
    notice.className = "notice " + (type || "");
    if (!message) {
      notice.className = "notice";
    }
  }

  async function fetchJson(url, options = {}) {
    try {
      const res = await fetch(url, { credentials: "same-origin", ...options });
      if (!res.ok) {
        return null;
      }
      const text = await res.text();
      if (!text) {
        return null;
      }
      try {
        return JSON.parse(text);
      } catch (error) {
        return null;
      }
    } catch (error) {
      return null;
    }
  }

  function updatePollInterval(settings) {
    if (!settings) {
      return;
    }
    const pollSeconds = Number(settings.poll_interval);
    if (!Number.isFinite(pollSeconds) || pollSeconds <= 0) {
      return;
    }
    const nextInterval = Math.round(pollSeconds * 1000);
    if (nextInterval === pollIntervalMs) {
      return;
    }
    pollIntervalMs = nextInterval;
    scheduleRefresh();
  }

  function scheduleRefresh() {
    if (pollIntervalId) {
      clearInterval(pollIntervalId);
    }
    pollIntervalId = setInterval(refreshDashboard, pollIntervalMs);
  }

  function formatMetricValue(value, options = {}) {
    if (!Number.isFinite(value)) {
      return "--";
    }
    return value.toLocaleString("de-DE", options);
  }

  function formatTemp(value) {
    if (value === null || value === undefined || value === "") {
      return "--";
    }
    const number = Number(value);
    if (!Number.isFinite(number)) {
      return "--";
    }
    return number.toFixed(1);
  }

  function createTempCell(hotend, bed) {
    const td = document.createElement("td");
    const hotendLine = document.createElement("div");
    const bedLine = document.createElement("div");
    hotendLine.textContent = `Hotend ${formatTemp(hotend)}C`;
    bedLine.textContent = `Bed ${formatTemp(bed)}C`;
    td.appendChild(hotendLine);
    td.appendChild(bedLine);
    return td;
  }

  function formatDuration(value) {
    if (value === null || value === undefined || value === "") {
      return "--";
    }
    const seconds = Number(value);
    if (!Number.isFinite(seconds) || seconds < 0) {
      return "--";
    }
    const rounded = Math.round(seconds);
    const hours = Math.floor(rounded / 3600);
    const minutes = Math.floor((rounded % 3600) / 60);
    const secs = rounded % 60;
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
  }

  function normalizeHost(value) {
    if (typeof value !== "string") {
      return "";
    }
    return value.trim();
  }

  function normalizeBackend(value) {
    if (typeof value !== "string") {
      return "";
    }
    return value.trim().toLowerCase();
  }

  function supportsUpload(printer) {
    const backend = normalizeBackend(printer && printer.backend);
    return uploadBackends.has(backend);
  }

  function buildWebUiUrl(printer) {
    if (!printer) {
      return "";
    }
    const host = normalizeHost(printer.host);
    if (!host) {
      return "";
    }
    if (host.startsWith("http://") || host.startsWith("https://")) {
      return host;
    }
    const scheme = printer.https ? "https" : "http";
    const port = Number(printer.port || (scheme === "https" ? 443 : 80));
    const defaultPort = (scheme === "https" && port === 443) || (scheme === "http" && port === 80);
    const portPart = defaultPort ? "" : `:${port}`;
    return `${scheme}://${host}${portPart}`;
  }

  function buildTasmotaUrl(printer) {
    if (!printer) {
      return "";
    }
    const host = normalizeHost(printer.tasmota_host);
    if (!host) {
      return "";
    }
    if (host.startsWith("http://") || host.startsWith("https://")) {
      return host.replace(/\/+$/, "");
    }
    if (/\s/.test(host)) {
      return "";
    }
    return `http://${host}`;
  }

  function createCell(text) {
    const td = document.createElement("td");
    td.textContent = text;
    return td;
  }

  function createNameCell(printer, groupMap) {
    const td = document.createElement("td");
    const name = printer && printer.name ? printer.name : "Unnamed printer";
    const groupId = printer && printer.group_id !== undefined ? Number(printer.group_id) : NaN;
    const groupName = Number.isFinite(groupId) && groupId > 0 ? groupMap.get(groupId) : null;
    const groupLabel = groupName ? groupName : "No group";
    const typeName = printer && printer.printer_type ? printer.printer_type : "No type";
    const nameLine = document.createElement("strong");
    nameLine.textContent = name;
    const typeLine = document.createElement("div");
    typeLine.className = "muted";
    typeLine.textContent = typeName;
    const groupLine = document.createElement("div");
    groupLine.className = "muted";
    groupLine.textContent = groupLabel;
    td.appendChild(nameLine);
    td.appendChild(typeLine);
    td.appendChild(groupLine);
    return td;
  }

  function createStatusCell(status) {
    const td = document.createElement("td");
    const badge = document.createElement("span");
    const state = status && status.status_state ? status.status_state : "muted";
    const label = status && status.status ? status.status : "Unknown";
    badge.className = `printer-status status-${state}`;
    badge.textContent = label;
    td.appendChild(badge);
    return td;
  }

  function createActionButton(label, url) {
    if (url) {
      const link = document.createElement("a");
      link.className = "btn soft small";
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = label;
      return link;
    }
    const button = document.createElement("button");
    button.className = "btn soft small";
    button.disabled = true;
    button.textContent = label;
    return button;
  }

  async function uploadAndPrint(printer, file, button) {
    if (!printer || !file) {
      return;
    }
    const printerName = printer.name || "Printer";
    const previousLabel = button.textContent;
    button.disabled = true;
    button.textContent = "Uploading...";
    setNotice(`Uploading ${file.name} to ${printerName}...`, "success");
    const formData = new FormData();
    formData.append("file", file, file.name);
    try {
      const res = await fetch(`/api/printers/${printer.id}/upload-print`, {
        method: "POST",
        credentials: "same-origin",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice(data.error || "Upload failed.", "error");
      } else {
        setNotice(`Upload started for ${printerName}.`, "success");
        await refreshDashboard();
      }
    } catch (error) {
      setNotice("Upload failed.", "error");
    } finally {
      button.disabled = false;
      button.textContent = previousLabel;
    }
  }

  function createActionsCell(printer) {
    const td = document.createElement("td");
    const stack = document.createElement("div");
    stack.className = "stack";
    const uploadButton = document.createElement("button");
    uploadButton.className = "btn primary small";
    uploadButton.type = "button";
    uploadButton.textContent = "Upload + Print";
    const uploadInput = document.createElement("input");
    uploadInput.type = "file";
    uploadInput.accept = ".gcode,.gco,.gc,.g,.bgcode";
    uploadInput.hidden = true;
    if (!supportsUpload(printer)) {
      uploadButton.disabled = true;
      uploadButton.title = "Unsupported backend";
    }
    uploadButton.addEventListener("click", () => {
      if (uploadButton.disabled) {
        return;
      }
      uploadInput.click();
    });
    uploadInput.addEventListener("change", async () => {
      const file = uploadInput.files && uploadInput.files[0];
      uploadInput.value = "";
      if (!file) {
        return;
      }
      await uploadAndPrint(printer, file, uploadButton);
    });
    stack.appendChild(uploadButton);
    stack.appendChild(createActionButton("Web UI", buildWebUiUrl(printer)));
    stack.appendChild(createActionButton("Tasmota", buildTasmotaUrl(printer)));
    td.appendChild(stack);
    td.appendChild(uploadInput);
    return td;
  }

  function isPrintingStatus(status) {
    if (!status || typeof status.status !== "string") {
      return false;
    }
    return status.status.toLowerCase().includes("printing");
  }

  function hasErrorStatus(status) {
    if (!status) {
      return false;
    }
    if (status.status_state === "error") {
      return true;
    }
    if (typeof status.error_message === "string" && status.error_message.trim()) {
      return true;
    }
    return false;
  }

  function normalizeSortKey(value) {
    if (typeof value !== "string") {
      return "";
    }
    return value.trim().toLowerCase();
  }

  function compareNumber(a, b, direction) {
    const aOk = Number.isFinite(a);
    const bOk = Number.isFinite(b);
    if (aOk && bOk) {
      if (a < b) {
        return direction === "asc" ? -1 : 1;
      }
      if (a > b) {
        return direction === "asc" ? 1 : -1;
      }
      return 0;
    }
    if (aOk) {
      return -1;
    }
    if (bOk) {
      return 1;
    }
    return 0;
  }

  function compareString(a, b, direction) {
    const aOk = typeof a === "string" && a.length > 0;
    const bOk = typeof b === "string" && b.length > 0;
    if (aOk && bOk) {
      if (a < b) {
        return direction === "asc" ? -1 : 1;
      }
      if (a > b) {
        return direction === "asc" ? 1 : -1;
      }
      return 0;
    }
    if (aOk) {
      return -1;
    }
    if (bOk) {
      return 1;
    }
    return 0;
  }

  function buildGroupMap(groups) {
    const map = new Map();
    if (!Array.isArray(groups)) {
      return map;
    }
    groups.forEach((group) => {
      const id = Number(group && group.id);
      if (!Number.isFinite(id)) {
        return;
      }
      const name = typeof group.name === "string" ? group.name.trim() : "";
      if (name) {
        map.set(id, name);
      }
    });
    return map;
  }

  function groupSortMeta(printer, groupMap) {
    const rawId = printer && printer.group_id !== undefined ? Number(printer.group_id) : NaN;
    if (Number.isFinite(rawId) && rawId > 0) {
      const groupName = groupMap.get(rawId);
      if (groupName) {
        return { rank: 0, group: normalizeSortKey(groupName) };
      }
      return { rank: 1, group: "" };
    }
    return { rank: 2, group: "" };
  }

  function sortPrintersByGroup(printers, groupMap) {
    return printers
      .map((printer, index) => ({ printer, index, meta: groupSortMeta(printer, groupMap) }))
      .sort((left, right) => {
        if (left.meta.rank !== right.meta.rank) {
          return left.meta.rank - right.meta.rank;
        }
        if (left.meta.group < right.meta.group) {
          return -1;
        }
        if (left.meta.group > right.meta.group) {
          return 1;
        }
        const leftName = normalizeSortKey(left.printer && left.printer.name);
        const rightName = normalizeSortKey(right.printer && right.printer.name);
        if (leftName < rightName) {
          return -1;
        }
        if (leftName > rightName) {
          return 1;
        }
        return left.index - right.index;
      })
      .map((entry) => entry.printer);
  }

  function buildStatusMap(statuses) {
    return new Map(
      statuses
        .filter((item) => item && Number.isFinite(Number(item.id)))
        .map((item) => [Number(item.id), item])
    );
  }

  function tempSortMeta(primary, secondary) {
    const primaryNumber = Number(primary);
    const secondaryNumber = Number(secondary);
    if (Number.isFinite(primaryNumber)) {
      return { primary: primaryNumber, secondary: secondaryNumber };
    }
    if (Number.isFinite(secondaryNumber)) {
      return { primary: secondaryNumber, secondary: NaN };
    }
    return { primary: NaN, secondary: NaN };
  }

  function sortValue(printer, status, key) {
    switch (key) {
      case "name":
        return { type: "string", primary: normalizeSortKey(printer && printer.name) };
      case "status":
        return { type: "string", primary: normalizeSortKey(status && status.status) };
      case "job":
        return { type: "string", primary: normalizeSortKey(status && status.job_name) };
      case "elapsed":
        return { type: "number", primary: Number(status && status.elapsed) };
      case "remaining":
        return { type: "number", primary: Number(status && status.remaining) };
      case "temp_now": {
        const meta = tempSortMeta(status && status.temp_hotend, status && status.temp_bed);
        return { type: "number-pair", ...meta };
      }
      case "target_temp": {
        const meta = tempSortMeta(status && status.target_hotend, status && status.target_bed);
        return { type: "number-pair", ...meta };
      }
      default:
        return { type: "string", primary: normalizeSortKey(printer && printer.name) };
    }
  }

  function sortPrintersByKey(printers, statusMap, key, direction) {
    return printers
      .map((printer, index) => ({
        printer,
        index,
        meta: sortValue(printer, statusMap.get(Number(printer.id)) || {}, key),
      }))
      .sort((left, right) => {
        const a = left.meta;
        const b = right.meta;
        let result = 0;
        if (a.type === "number") {
          result = compareNumber(a.primary, b.primary, direction);
        } else if (a.type === "number-pair") {
          result = compareNumber(a.primary, b.primary, direction);
          if (result === 0) {
            result = compareNumber(a.secondary, b.secondary, direction);
          }
        } else {
          result = compareString(a.primary, b.primary, direction);
        }
        if (result !== 0) {
          return result;
        }
        const leftName = normalizeSortKey(left.printer && left.printer.name);
        const rightName = normalizeSortKey(right.printer && right.printer.name);
        const nameResult = compareString(leftName, rightName, "asc");
        if (nameResult !== 0) {
          return nameResult;
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

  function normalizeTypeName(value) {
    if (typeof value !== "string") {
      return "";
    }
    return value.trim();
  }

  function buildUploadTypeSet(types) {
    const set = new Set();
    if (!Array.isArray(types)) {
      return set;
    }
    types.forEach((type) => {
      const name = normalizeTypeName(type && type.name);
      if (!name) {
        return;
      }
      if (type && type.upload_gcode_active) {
        set.add(name.toLowerCase());
      }
    });
    return set;
  }

  function filterPrintersForUpload(printers, uploadSet) {
    if (!uploadSet || uploadSet.size === 0) {
      return [];
    }
    return printers.filter((printer) => {
      const typeName = normalizeTypeName(printer && printer.printer_type);
      if (!typeName) {
        return false;
      }
      return uploadSet.has(typeName.toLowerCase());
    });
  }

  function renderTable(printers, statuses, groups, types) {
    const uploadSet = buildUploadTypeSet(types);
    const matchingPrinters = filterPrintersForUpload(printers, uploadSet);
    const groupMap = buildGroupMap(groups);
    tableBody.innerHTML = "";
    if (!matchingPrinters.length) {
      tableBody.innerHTML = "<tr><td colspan=\"8\" class=\"muted\">No printers with Upload G-Code active.</td></tr>";
      return;
    }
    const statusMap = buildStatusMap(statuses);
    const sortedPrinters = sortState.key
      ? sortPrintersByKey(matchingPrinters, statusMap, sortState.key, sortState.direction)
      : sortPrintersByGroup(matchingPrinters, groupMap);
    sortedPrinters.forEach((printer) => {
      const status = statusMap.get(Number(printer.id)) || {};
      const row = document.createElement("tr");
      row.appendChild(createNameCell(printer, groupMap));
      row.appendChild(createStatusCell(status));
      row.appendChild(createTempCell(status.temp_hotend, status.temp_bed));
      row.appendChild(createTempCell(status.target_hotend, status.target_bed));
      row.appendChild(createCell(status.job_name || "--"));
      row.appendChild(createCell(formatDuration(status.elapsed)));
      row.appendChild(createCell(formatDuration(status.remaining)));
      row.appendChild(createActionsCell(printer));
      tableBody.appendChild(row);
    });
  }

  function updateSnapshot(printersData, statusData, energyData) {
    const printers = (printersData && printersData.items) || [];
    const statuses = (statusData && statusData.items) || [];
    const totalPrinters = statusData ? Number(statusData.total_printers) : NaN;
    const totalCount = Number.isFinite(totalPrinters) ? totalPrinters : printers.length || statuses.length;
    const printerCount = document.getElementById("printerCount");
    if (printerCount) {
      printerCount.textContent = Number.isFinite(totalCount) ? totalCount : "--";
    }

    const activePrintsEl = document.getElementById("activePrintsCount");
    const activeErrorsEl = document.getElementById("activeErrorsCount");
    if (statuses.length) {
      const activePrints = statuses.filter(isPrintingStatus).length;
      const activeErrors = statuses.filter(hasErrorStatus).length;
      if (activePrintsEl) {
        activePrintsEl.textContent = Number.isFinite(activePrints) ? activePrints : "--";
      }
      if (activeErrorsEl) {
        activeErrorsEl.textContent = Number.isFinite(activeErrors) ? activeErrors : "--";
      }
    } else {
      if (activePrintsEl) {
        activePrintsEl.textContent = "--";
      }
      if (activeErrorsEl) {
        activeErrorsEl.textContent = "--";
      }
    }

    const energyItems = energyData && Array.isArray(energyData.items) ? energyData.items : [];
    let totalPower = 0;
    let powerCount = 0;
    let totalEnergyWh = 0;
    let energyCount = 0;
    energyItems.forEach((item) => {
      if (!item) {
        return;
      }
      const power = Number(item.power_w);
      if (Number.isFinite(power)) {
        totalPower += power;
        powerCount += 1;
      }
      const todayWh = Number(item.today_wh);
      if (Number.isFinite(todayWh)) {
        totalEnergyWh += todayWh;
        energyCount += 1;
      }
    });
    const totalPowerNow = document.getElementById("totalPowerNow");
    if (totalPowerNow) {
      totalPowerNow.textContent = powerCount
        ? formatMetricValue(totalPower, { maximumFractionDigits: 1 })
        : "--";
    }
    const totalEnergyToday = document.getElementById("totalEnergyToday");
    if (totalEnergyToday) {
      totalEnergyToday.textContent = energyCount
        ? formatMetricValue(totalEnergyWh / 1000, { maximumFractionDigits: 2 })
        : "--";
    }
  }

  async function refreshDashboard() {
    const [settingsData, printersData, statusData, energyData, groupsData, typesData] = await Promise.all([
      fetchJson("/api/settings"),
      fetchJson("/api/printers"),
      fetchJson("/api/live-wall/status", { cache: "no-store" }),
      fetchJson("/api/printers/plug-energy", { cache: "no-store" }),
      fetchJson("/api/printer-groups"),
      fetchJson("/api/printer-types"),
    ]);
    updatePollInterval(settingsData);
    updateSnapshot(printersData, statusData, energyData);
    cachedPrinters = (printersData && printersData.items) || [];
    cachedStatuses = (statusData && statusData.items) || [];
    cachedGroups = (groupsData && groupsData.items) || [];
    cachedTypes = (typesData && typesData.items) || [];
    renderTable(cachedPrinters, cachedStatuses, cachedGroups, cachedTypes);
  }

  async function initDashboard() {
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
        renderTable(cachedPrinters, cachedStatuses, cachedGroups, cachedTypes);
      });
    });
    updateSortButtons();
    await refreshDashboard();
    scheduleRefresh();
  }

  initDashboard();
});
