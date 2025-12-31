document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("printerForm");
  const notice = document.getElementById("printerNotice");
  const submitBtn = document.getElementById("printerSubmit");
  const resetBtn = document.getElementById("printerReset");
  const refreshBtn = document.getElementById("printerRefresh");
  const netScanBtn = document.getElementById("netScanButton");
  const netScanNotice = document.getElementById("netScanNotice");
  const netScanTable = document.getElementById("netScanTable");

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
    const items = data.items || [];
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
        netScanTable.innerHTML = "";
        if (!items.length) {
          netScanTable.innerHTML = "<tr><td colspan=\"5\" class=\"muted\">No devices found.</td></tr>";
          setNetScanNotice("No devices found.", "success");
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
        setNetScanNotice(`Found ${items.length} device(s).`, "success");
      } catch (error) {
        setNetScanNotice("Net scan failed.", "error");
        netScanTable.innerHTML = "<tr><td colspan=\"5\" class=\"muted\">Scan failed.</td></tr>";
      } finally {
        netScanBtn.disabled = false;
      }
    });
  }

  loadPrinters();
});
