document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("printerForm");
  const notice = document.getElementById("printerNotice");
  const submitBtn = document.getElementById("printerSubmit");
  const resetBtn = document.getElementById("printerReset");
  const refreshBtn = document.getElementById("printerRefresh");

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

  function formData() {
    return {
      name: document.getElementById("printerName").value.trim(),
      backend: document.getElementById("printerBackend").value,
      host: document.getElementById("printerHost").value.trim(),
      port: Number(document.getElementById("printerPort").value || 80),
      https: document.getElementById("printerHttps").checked,
      enabled: document.getElementById("printerEnabled").checked,
      no_scanning: document.getElementById("printerNoScan").checked,
    };
  }

  function fillForm(printer) {
    document.getElementById("printerId").value = printer.id;
    document.getElementById("printerName").value = printer.name || "";
    document.getElementById("printerBackend").value = printer.backend || "";
    document.getElementById("printerHost").value = printer.host || "";
    document.getElementById("printerPort").value = printer.port || 80;
    document.getElementById("printerHttps").checked = !!printer.https;
    document.getElementById("printerEnabled").checked = !!printer.enabled;
    document.getElementById("printerNoScan").checked = !!printer.no_scanning;
    submitBtn.textContent = "Save changes";
  }

  function clearForm(options) {
    const keepNotice = options && options.keepNotice;
    document.getElementById("printerId").value = "";
    document.getElementById("printerName").value = "";
    document.getElementById("printerBackend").value = "";
    document.getElementById("printerHost").value = "";
    document.getElementById("printerPort").value = 80;
    document.getElementById("printerHttps").checked = false;
    document.getElementById("printerEnabled").checked = true;
    document.getElementById("printerNoScan").checked = false;
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
      table.innerHTML = "<tr><td colspan=\"7\" class=\"muted\">No printers loaded yet.</td></tr>";
      return;
    }
    items.forEach((printer) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${printer.name}</td>
        <td>${printer.backend}</td>
        <td>${printer.host}</td>
        <td>${printer.port}</td>
        <td>${printer.https ? "Yes" : "No"}</td>
        <td>${printer.enabled ? "Yes" : "No"}</td>
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

  loadPrinters();
});
