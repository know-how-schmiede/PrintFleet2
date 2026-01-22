document.addEventListener("DOMContentLoaded", () => {
  const tableBody = document.getElementById("printerGroupJustTable");
  if (!tableBody) {
    return;
  }

  const sortButtons = Array.from(document.querySelectorAll("[data-sort]"));
  const notice = document.getElementById("printerGroupJustNotice");
  let sortState = { key: "name", direction: "asc" };
  let pollIntervalId = null;
  let pollIntervalMs = 5000;
  const DEFAULT_FILENAME_DISPLAY_LENGTH = 32;
  const MIN_FILENAME_DISPLAY_LENGTH = 10;
  const MAX_FILENAME_DISPLAY_LENGTH = 120;
  let filenameDisplayLength = DEFAULT_FILENAME_DISPLAY_LENGTH;
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

  function normalizeFilenameDisplayLength(value) {
    if (value === null || value === undefined || value === "") {
      return DEFAULT_FILENAME_DISPLAY_LENGTH;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return DEFAULT_FILENAME_DISPLAY_LENGTH;
    }
    const rounded = Math.round(parsed);
    if (rounded < MIN_FILENAME_DISPLAY_LENGTH) {
      return MIN_FILENAME_DISPLAY_LENGTH;
    }
    if (rounded > MAX_FILENAME_DISPLAY_LENGTH) {
      return MAX_FILENAME_DISPLAY_LENGTH;
    }
    return rounded;
  }

  function updateFilenameDisplayLength(settings) {
    if (!settings) {
      return;
    }
    filenameDisplayLength = normalizeFilenameDisplayLength(settings.filename_display_length);
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

  function sumPrintTime(printers, key) {
    if (!Array.isArray(printers)) {
      return NaN;
    }
    let total = 0;
    let count = 0;
    printers.forEach((printer) => {
      if (!printer) {
        return;
      }
      const value = Number(printer[key]);
      if (Number.isFinite(value)) {
        total += value;
        count += 1;
      }
    });
    return count ? total : NaN;
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

  function normalizeEnabled(value, fallback = false) {
    if (value === null || value === undefined) {
      return fallback;
    }
    if (typeof value === "boolean") {
      return value;
    }
    if (typeof value === "number") {
      return value !== 0;
    }
    if (typeof value === "string") {
      const lowered = value.trim().toLowerCase();
      if (lowered === "1" || lowered === "true" || lowered === "yes" || lowered === "on") {
        return true;
      }
      if (lowered === "0" || lowered === "false" || lowered === "no" || lowered === "off") {
        return false;
      }
    }
    return fallback;
  }

  function isPrinterEnabled(printer) {
    return normalizeEnabled(printer && printer.enabled, false);
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

  function buildStatusMap(statuses) {
    return new Map(
      statuses
        .filter((item) => item && Number.isFinite(Number(item.id)))
        .map((item) => [Number(item.id), item])
    );
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
      if (!isPrinterEnabled(printer)) {
        return false;
      }
      const typeName = normalizeTypeName(printer && printer.printer_type);
      if (!typeName) {
        return false;
      }
      if (!uploadSet.has(typeName.toLowerCase())) {
        return false;
      }
      return supportsUpload(printer);
    });
  }

  function normalizeJobDisplay(value) {
    if (typeof value !== "string") {
      return "--";
    }
    const trimmed = value.trim();
    return trimmed ? trimmed : "--";
  }

  function truncateText(text, maxLength) {
    if (!Number.isFinite(maxLength) || maxLength <= 0) {
      return text;
    }
    if (text.length <= maxLength) {
      return text;
    }
    if (maxLength <= 3) {
      return text.slice(0, maxLength);
    }
    return `${text.slice(0, maxLength - 3)}...`;
  }

  function createJobCell(jobName) {
    const td = document.createElement("td");
    const normalized = normalizeJobDisplay(jobName);
    if (normalized === "--") {
      td.textContent = normalized;
      return td;
    }
    td.textContent = truncateText(normalized, filenameDisplayLength);
    td.title = normalized;
    return td;
  }

  function deriveGroupJobStatus(printers, statusMap) {
    const jobNames = [];
    const printingStatuses = [];
    printers.forEach((printer) => {
      const status = statusMap.get(Number(printer.id)) || {};
      const jobName = normalizeJobDisplay(status.job_name);
      if (jobName !== "--") {
        jobNames.push(jobName);
      }
      if (isPrintingStatus(status)) {
        printingStatuses.push(status);
      }
    });

    let jobLabel = "--";
    if (jobNames.length) {
      const normalized = jobNames.map((job) => normalizeSortKey(job)).filter(Boolean);
      const uniqueJobs = Array.from(new Set(normalized));
      if (uniqueJobs.length === 1) {
        jobLabel = jobNames[0];
      } else {
        jobLabel = "Multiple jobs";
      }
    }

    let elapsedSeconds = NaN;
    let remainingSeconds = NaN;
    if (printingStatuses.length === 1) {
      elapsedSeconds = Number(printingStatuses[0].elapsed);
      remainingSeconds = Number(printingStatuses[0].remaining);
    }

    return {
      jobLabel,
      jobSort: normalizeSortKey(jobLabel),
      elapsedSeconds,
      remainingSeconds,
      elapsedDisplay: formatDuration(elapsedSeconds),
      remainingDisplay: formatDuration(remainingSeconds),
    };
  }

  function buildGroupEntries(printers, statusMap, groupMap) {
    const byId = new Map();
    printers.forEach((printer) => {
      const rawId = Number(printer && printer.group_id);
      const groupId = Number.isFinite(rawId) && rawId > 0 ? rawId : 0;
      let entry = byId.get(groupId);
      if (!entry) {
        const groupName = groupId === 0 ? "No group" : groupMap.get(groupId) || `Group ${groupId}`;
        entry = {
          id: groupId,
          name: groupName,
          printers: [],
        };
        byId.set(groupId, entry);
      }
      entry.printers.push(printer);
    });

    return Array.from(byId.values()).map((entry) => {
      const statusMeta = deriveGroupJobStatus(entry.printers, statusMap);
      return {
        ...entry,
        ...statusMeta,
      };
    });
  }

  function sortValue(entry, key) {
    switch (key) {
      case "name":
        return { type: "string", primary: normalizeSortKey(entry.name) };
      case "job":
        return { type: "string", primary: entry.jobSort || normalizeSortKey(entry.jobLabel) };
      case "elapsed":
        return { type: "number", primary: entry.elapsedSeconds };
      case "remaining":
        return { type: "number", primary: entry.remainingSeconds };
      default:
        return { type: "string", primary: normalizeSortKey(entry.name) };
    }
  }

  function sortGroupsByKey(entries, key, direction) {
    return entries
      .map((entry, index) => ({ entry, index, meta: sortValue(entry, key) }))
      .sort((left, right) => {
        const a = left.meta;
        const b = right.meta;
        let result = 0;
        if (a.type === "number") {
          result = compareNumber(a.primary, b.primary, direction);
        } else {
          result = compareString(a.primary, b.primary, direction);
        }
        if (result !== 0) {
          return result;
        }
        const leftName = normalizeSortKey(left.entry.name);
        const rightName = normalizeSortKey(right.entry.name);
        const nameResult = compareString(leftName, rightName, "asc");
        if (nameResult !== 0) {
          return nameResult;
        }
        return left.index - right.index;
      })
      .map((wrapped) => wrapped.entry);
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

  function updateSnapshot(printersData, statusData, energyData) {
    const printers = (printersData && printersData.items) || [];
    const statuses = (statusData && statusData.items) || [];
    const totalPrinters = statusData ? Number(statusData.total_printers) : NaN;
    const totalCount = Number.isFinite(totalPrinters) ? totalPrinters : printers.length || statuses.length;
    const enabledCount =
      statusData && Array.isArray(statusData.items)
        ? statusData.items.length
        : printers.filter(isPrinterEnabled).length;
    const printerCountAll =
      document.getElementById("printerCountAll") || document.getElementById("printerCount");
    if (printerCountAll) {
      printerCountAll.textContent = Number.isFinite(totalCount) ? totalCount : "--";
    }
    const printerCountEnabled = document.getElementById("printerCountEnabled");
    if (printerCountEnabled) {
      printerCountEnabled.textContent = Number.isFinite(enabledCount) ? enabledCount : "--";
    }

    const activePrintsEl = document.getElementById("activePrintsCount");
    const activeErrorsEl = document.getElementById("activeErrorsCount");
    const printJobsTodayEl = document.getElementById("printJobsTodayCount");
    const printJobsTotalEl = document.getElementById("printJobsTotalCount");
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
    const jobsToday = statusData ? Number(statusData.total_print_jobs_today) : NaN;
    const jobsTotal = statusData ? Number(statusData.total_print_jobs_total) : NaN;
    if (printJobsTodayEl) {
      printJobsTodayEl.textContent = Number.isFinite(jobsToday) ? jobsToday : "--";
    }
    if (printJobsTotalEl) {
      printJobsTotalEl.textContent = Number.isFinite(jobsTotal) ? jobsTotal : "--";
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

    const statusTodaySeconds = statusData ? Number(statusData.total_print_time_today_seconds) : NaN;
    const statusTotalSeconds = statusData ? Number(statusData.total_print_time_total_seconds) : NaN;
    const totalTodaySeconds = Number.isFinite(statusTodaySeconds)
      ? statusTodaySeconds
      : sumPrintTime(printers, "print_time_today_seconds");
    const totalAllSeconds = Number.isFinite(statusTotalSeconds)
      ? statusTotalSeconds
      : sumPrintTime(printers, "print_time_total_seconds");
    const totalPrintTimeToday = document.getElementById("totalPrintTimeToday");
    if (totalPrintTimeToday) {
      totalPrintTimeToday.textContent = Number.isFinite(totalTodaySeconds)
        ? formatMetricValue(totalTodaySeconds / 3600, { maximumFractionDigits: 1 })
        : "--";
    }
    const totalPrintTimeTotal = document.getElementById("totalPrintTimeTotal");
    if (totalPrintTimeTotal) {
      totalPrintTimeTotal.textContent = Number.isFinite(totalAllSeconds)
        ? formatMetricValue(totalAllSeconds / 3600, { maximumFractionDigits: 1 })
        : "--";
    }
  }

  async function clearPrinterCheck(printer) {
    const res = await fetch(`/api/printers/${printer.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ print_check_status: "clear" }),
    });
    return res.ok;
  }

  async function clearPrinterChecks(printers) {
    const results = await Promise.all(
      printers.map(async (printer) => ({ printer, ok: await clearPrinterCheck(printer) }))
    );
    const cleared = [];
    const failed = [];
    results.forEach((result) => {
      if (result.ok) {
        cleared.push(result.printer);
      } else {
        failed.push(result.printer);
      }
    });
    return { cleared, failed };
  }

  async function uploadToPrinter(printer, file) {
    const formData = new FormData();
    formData.append("file", file, file.name);
    try {
      const res = await fetch(
        `/api/printers/${printer.id}/upload-print?print_via=JustGroupPrinting`,
        {
          method: "POST",
          credentials: "same-origin",
          body: formData,
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { ok: false, error: data.error || "Upload failed.", code: data.code };
      }
      return { ok: true };
    } catch (error) {
      return { ok: false, error: "Upload failed." };
    }
  }

  function formatPrinterList(printers, limit = 4) {
    const names = printers
      .map((printer) => (printer && printer.name ? printer.name : "Unnamed printer"))
      .slice(0, limit);
    const remaining = printers.length - names.length;
    if (remaining > 0) {
      names.push(`+${remaining} more`);
    }
    return names.join(", ");
  }

  async function uploadGroup(entry, file, button) {
    const previousLabel = button.textContent;
    button.disabled = true;
    button.textContent = "Uploading...";

    const statusMap = buildStatusMap(cachedStatuses);
    let readyPrinters = Array.isArray(entry.printers) ? [...entry.printers] : [];
    if (!readyPrinters.length) {
      setNotice("No printers available for this group.", "error");
      button.disabled = false;
      button.textContent = previousLabel;
      return;
    }

    const busyPrinters = [];
    const checkPrinters = [];
    readyPrinters = readyPrinters.filter((printer) => {
      const status = statusMap.get(Number(printer.id)) || {};
      if (isPrintingStatus(status)) {
        busyPrinters.push(printer);
        return false;
      }
      if (normalizePrintCheckStatus(printer.print_check_status) !== "clear") {
        checkPrinters.push(printer);
      }
      return true;
    });

    if (busyPrinters.length) {
      setNotice(
        `${busyPrinters.length} printer(s) are busy and will be skipped: ${formatPrinterList(
          busyPrinters
        )}.`,
        "error"
      );
    }

    if (!readyPrinters.length) {
      button.disabled = false;
      button.textContent = previousLabel;
      return;
    }

    if (checkPrinters.length) {
      const confirmed = window.confirm(
        "Checklist before the next print:\n" +
          "- Print bed is clear and clean\n" +
          "- Correct filament is loaded\n" +
          "- G-Code file matches the printer model\n" +
          "- Axes and parts move freely\n\n" +
          "Set status to Clear for the selected printers?"
      );
      if (!confirmed) {
        setNotice("Upload cancelled.", "error");
        button.disabled = false;
        button.textContent = previousLabel;
        return;
      }
      const { cleared, failed } = await clearPrinterChecks(checkPrinters);
      if (failed.length) {
        setNotice(
          `${failed.length} printer(s) could not be cleared and will be skipped: ${formatPrinterList(
            failed
          )}.`,
          "error"
        );
      }
      readyPrinters = readyPrinters.filter(
        (printer) =>
          normalizePrintCheckStatus(printer.print_check_status) === "clear" ||
          cleared.includes(printer)
      );
    }

    if (!readyPrinters.length) {
      button.disabled = false;
      button.textContent = previousLabel;
      return;
    }

    const confirmedUpload = window.confirm(
      `Upload ${file.name} to ${readyPrinters.length} printer(s) in ${entry.name}?`
    );
    if (!confirmedUpload) {
      setNotice("Upload cancelled.", "error");
      button.disabled = false;
      button.textContent = previousLabel;
      return;
    }

    setNotice(`Uploading ${file.name} to ${entry.name}...`, "success");
    const results = await Promise.all(readyPrinters.map((printer) => uploadToPrinter(printer, file)));
    let successCount = 0;
    let failureCount = 0;
    results.forEach((result) => {
      if (result.ok) {
        successCount += 1;
      } else {
        failureCount += 1;
      }
    });

    if (failureCount) {
      setNotice(
        `Upload finished for ${entry.name}: ${successCount} ok, ${failureCount} failed.`,
        "error"
      );
    } else {
      setNotice(`Upload started for ${entry.name}: ${successCount} printer(s).`, "success");
    }

    await refreshDashboard();
    button.disabled = false;
    button.textContent = previousLabel;
  }

  function createActionsCell(entry) {
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
    if (!entry.printers || entry.printers.length === 0) {
      uploadButton.disabled = true;
      uploadButton.title = "No printers available";
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
      await uploadGroup(entry, file, uploadButton);
    });
    stack.appendChild(uploadButton);
    td.appendChild(stack);
    td.appendChild(uploadInput);
    return td;
  }

  function renderTable(printers, statuses, groups, types) {
    const uploadSet = buildUploadTypeSet(types);
    const eligiblePrinters = filterPrintersForUpload(printers, uploadSet);
    const statusMap = buildStatusMap(statuses);
    const groupMap = buildGroupMap(groups);
    const groupEntries = buildGroupEntries(eligiblePrinters, statusMap, groupMap);
    tableBody.innerHTML = "";
    if (!groupEntries.length) {
      tableBody.innerHTML =
        "<tr><td colspan=\"5\" class=\"muted\">No groups with Upload G-Code active.</td></tr>";
      return;
    }
    const sortedGroups = sortState.key
      ? sortGroupsByKey(groupEntries, sortState.key, sortState.direction)
      : groupEntries;
    sortedGroups.forEach((entry) => {
      const row = document.createElement("tr");
      row.appendChild(document.createElement("td")).textContent = entry.name;
      row.appendChild(createJobCell(entry.jobLabel));
      row.appendChild(document.createElement("td")).textContent = entry.elapsedDisplay;
      row.appendChild(document.createElement("td")).textContent = entry.remainingDisplay;
      row.appendChild(createActionsCell(entry));
      tableBody.appendChild(row);
    });
  }

  async function refreshDashboard() {
    const [settingsData, printersData, statusData, energyData, groupsData, typesData] =
      await Promise.all([
        fetchJson("/api/settings"),
        fetchJson("/api/printers"),
        fetchJson("/api/live-wall/status", { cache: "no-store" }),
        fetchJson("/api/printers/plug-energy", { cache: "no-store" }),
        fetchJson("/api/printer-groups"),
        fetchJson("/api/printer-types"),
      ]);
    updatePollInterval(settingsData);
    updateFilenameDisplayLength(settingsData);
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
