document.addEventListener("DOMContentLoaded", () => {
  const tableBody = document.getElementById("logTable");
  const notice = document.getElementById("logNotice");
  const refreshBtn = document.getElementById("logRefresh");

  if (!tableBody) {
    return;
  }

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

  function renderRows(items) {
    tableBody.innerHTML = "";
    if (!items.length) {
      tableBody.innerHTML = "<tr><td colspan=\"5\" class=\"muted\">No logs yet.</td></tr>";
      return;
    }
    items.forEach((item) => {
      const row = document.createElement("tr");
      const dateCell = document.createElement("td");
      const fileCell = document.createElement("td");
      const printerCell = document.createElement("td");
      const userCell = document.createElement("td");
      const viaCell = document.createElement("td");

      dateCell.textContent = item.job_date || "--";
      fileCell.textContent = item.gcode_filename || "--";
      printerCell.textContent = item.printer_name || "--";
      userCell.textContent = item.username || "--";
      viaCell.textContent = item.print_via || "--";

      row.appendChild(dateCell);
      row.appendChild(fileCell);
      row.appendChild(printerCell);
      row.appendChild(userCell);
      row.appendChild(viaCell);
      tableBody.appendChild(row);
    });
  }

  async function loadLogs() {
    setNotice("", "");
    const res = await fetch("/api/print-jobs", { cache: "no-store" });
    if (!res.ok) {
      setNotice("Failed to load logs.", "error");
      return;
    }
    const data = await res.json().catch(() => ({}));
    const items = Array.isArray(data.items) ? data.items : [];
    renderRows(items);
  }

  if (refreshBtn) {
    refreshBtn.addEventListener("click", loadLogs);
  }

  loadLogs();
});
