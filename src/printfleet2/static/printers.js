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
  const sortButtons = Array.from(document.querySelectorAll("[data-sort]"));
  const netScanFilters = [
    { id: "netScanFilterElegoo", type: "elegoo-centurio-carbon" },
    { id: "netScanFilterMoonraker", type: "moonraker" },
    { id: "netScanFilterOctoPrint", type: "octoprint" },
    { id: "netScanFilterTasmota", type: "tasmota" },
  ];

  if (!form || !notice || !submitBtn || !resetBtn || !refreshBtn) {
    return;
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

  function numericValue(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function buildImportPayload(raw) {
    if (!raw || typeof raw !== "object") {
      return null;
    }
    const name = normalizeText(raw.name);
    const backend = normalizeText(raw.backend);
    const host = normalizeText(raw.host);
    if (!name || !backend || !host) {
      return null;
    }
    return {
      name,
      backend,
      host,
      port: numericValue(raw.port, 80),
      error_report_interval: numericValue(raw.error_report_interval, 30),
      location: optionalText(raw.location),
      printer_type: optionalText(raw.printer_type),
      notes: optionalText(raw.notes),
      token: optionalText(raw.token),
      api_key: optionalText(raw.api_key),
      tasmota_host: optionalText(raw.tasmota_host),
      tasmota_topic: optionalText(raw.tasmota_topic),
      https: !!raw.https,
      enabled: raw.enabled !== undefined ? !!raw.enabled : true,
      scanning:
        raw.scanning !== undefined ? !!raw.scanning : raw.no_scanning !== undefined ? !raw.no_scanning : true,
    };
  }

  function normalizeKey(value) {
    if (typeof value !== "string") {
      return "";
    }
    return value.trim().toLowerCase();
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
    netScanTimestamp.textContent = `Letzter Scan: ${formatDateTime(date)}`;
  }

  let lastNetScan = { items: [], scannedAt: null };

  let printersCache = [];
  let sortState = { key: null, direction: "asc" };

  function sortValue(printer, key) {
    if (!printer) {
      return "";
    }
    switch (key) {
      case "name":
        return normalizeKey(printer.name);
      case "host":
        return normalizeKey(printer.host);
      case "enabled":
        return printer.enabled ? 1 : 0;
      case "scanning":
        return printer.scanning ? 1 : 0;
      case "tasmota_host":
        return normalizeKey(printer.tasmota_host);
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
      row.innerHTML = `
        <td>${printer.name}</td>
        <td>${printer.backend}</td>
        <td>${printer.host}</td>
        <td>${printer.enabled ? "Yes" : "No"}</td>
        <td>${printer.scanning ? "Yes" : "No"}</td>
        <td>${printer.tasmota_host ? printer.tasmota_host : "-"}</td>
        <td>${webUrl ? `<a class="btn small outline" href="${webUrl}" target="_blank" rel="noopener">Open</a>` : "-"}</td>
        <td>
          <button class="btn small" data-action="edit" type="button">Edit</button>
          <button class="btn small danger" data-action="delete" type="button">Delete</button>
        </td>
      `;
      const editBtn = row.querySelector('[data-action="edit"]');
      const deleteBtn = row.querySelector('[data-action="delete"]');
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
      table.appendChild(row);
    });
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
    netScanTable.innerHTML = "";
    if (!items.length) {
      netScanTable.innerHTML = "<tr><td colspan=\"5\" class=\"muted\">No devices found.</td></tr>";
      return;
    }
    items.forEach((device) => {
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
    document.getElementById("printerType").value = printer.printer_type || "";
    document.getElementById("printerNotes").value = printer.notes || "";
    document.getElementById("printerToken").value = printer.token || "";
    document.getElementById("printerApiKey").value = printer.api_key || "";
    document.getElementById("printerTasmotaHost").value = printer.tasmota_host || "";
    document.getElementById("printerTasmotaTopic").value = printer.tasmota_topic || "";
    document.getElementById("printerHttps").checked = !!printer.https;
    document.getElementById("printerEnabled").checked = !!printer.enabled;
    document.getElementById("printerScanning").checked =
      printer.scanning !== undefined ? !!printer.scanning : !printer.no_scanning;
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
    document.getElementById("printerType").value = "";
    document.getElementById("printerNotes").value = "";
    document.getElementById("printerToken").value = "";
    document.getElementById("printerApiKey").value = "";
    document.getElementById("printerTasmotaHost").value = "";
    document.getElementById("printerTasmotaTopic").value = "";
    document.getElementById("printerHttps").checked = false;
    document.getElementById("printerEnabled").checked = true;
    document.getElementById("printerScanning").checked = true;
    submitBtn.textContent = "Create printer";
    if (!keepNotice) {
      setNotice("", "");
    }
  }

  async function loadPrinters() {
    const res = await fetch("/api/printers");
    const data = res.ok ? await res.json() : { items: [] };
    if (!res.ok) {
      setNotice("Failed to load printers.", "error");
    }
    printersCache = data.items || [];
    renderPrinterTable(sortedPrinters(printersCache));
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
        existingItems.map((printer) =>
          buildHostKey({
            backend: printer.backend,
            host: printer.host,
            port: printer.port,
          })
        ).filter(Boolean)
      );
      for (const raw of items) {
        const data = buildImportPayload(raw);
        if (!data) {
          skippedInvalid += 1;
          continue;
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
          setNetScanNotice("Net scan failed.", "error");
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
        setNetScanNotice("Net scan failed.", "error");
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
      setNetScanNotice("Net scan export started.", "success");
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

  loadPrinters();
  updateSortButtons();
});
