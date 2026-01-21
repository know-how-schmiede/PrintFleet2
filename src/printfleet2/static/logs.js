document.addEventListener("DOMContentLoaded", () => {
  const tableBody = document.getElementById("logTable");
  const notice = document.getElementById("logNotice");
  const refreshBtn = document.getElementById("logRefresh");
  const startInput = document.getElementById("logStartDate");
  const endInput = document.getElementById("logEndDate");
  const rangeSelect = document.getElementById("logRange");
  const clearBtn = document.getElementById("logClear");

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

  function renderRows(items, filtered) {
    tableBody.innerHTML = "";
    if (!items.length) {
      const message = filtered ? "No logs for the selected period." : "No logs yet.";
      tableBody.innerHTML = `<tr><td colspan="5" class="muted">${message}</td></tr>`;
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

  function formatDate(value) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function applyPreset(preset) {
    if (!startInput || !endInput) {
      return;
    }
    const now = new Date();
    let start = null;
    let end = null;
    if (preset === "current-week") {
      const dayIndex = (now.getDay() + 6) % 7;
      start = new Date(now);
      start.setDate(now.getDate() - dayIndex);
      end = new Date(start);
      end.setDate(start.getDate() + 6);
    } else if (preset === "current-month") {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    } else if (preset === "current-year") {
      start = new Date(now.getFullYear(), 0, 1);
      end = new Date(now.getFullYear(), 11, 31);
    } else if (preset === "last-28-days") {
      end = new Date(now);
      start = new Date(now);
      start.setDate(now.getDate() - 27);
    }
    if (start) {
      startInput.value = formatDate(start);
    }
    if (end) {
      endInput.value = formatDate(end);
    }
  }

  async function loadLogs() {
    setNotice("", "");
    const startDate = startInput ? startInput.value : "";
    const endDate = endInput ? endInput.value : "";
    if (startDate && endDate && startDate > endDate) {
      setNotice("Start date must be before end date.", "error");
      return;
    }
    const params = new URLSearchParams();
    if (startDate) {
      params.set("start_date", startDate);
    }
    if (endDate) {
      params.set("end_date", endDate);
    }
    const url = params.toString() ? `/api/print-jobs?${params.toString()}` : "/api/print-jobs";
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      setNotice("Failed to load logs.", "error");
      return;
    }
    const data = await res.json().catch(() => ({}));
    const items = Array.isArray(data.items) ? data.items : [];
    renderRows(items, Boolean(startDate || endDate));
  }

  if (refreshBtn) {
    refreshBtn.addEventListener("click", loadLogs);
  }
  if (rangeSelect) {
    rangeSelect.addEventListener("change", () => {
      if (!rangeSelect.value) {
        return;
      }
      applyPreset(rangeSelect.value);
      loadLogs();
    });
  }
  if (startInput) {
    startInput.addEventListener("change", () => {
      if (rangeSelect) {
        rangeSelect.value = "";
      }
      loadLogs();
    });
  }
  if (endInput) {
    endInput.addEventListener("change", () => {
      if (rangeSelect) {
        rangeSelect.value = "";
      }
      loadLogs();
    });
  }
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      if (rangeSelect) {
        rangeSelect.value = "";
      }
      if (startInput) {
        startInput.value = "";
      }
      if (endInput) {
        endInput.value = "";
      }
      loadLogs();
    });
  }

  loadLogs();
});
