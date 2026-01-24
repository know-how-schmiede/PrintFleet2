document.addEventListener("DOMContentLoaded", () => {
  const tableBody = document.getElementById("logTable");
  const notice = document.getElementById("logNotice");
  const refreshBtn = document.getElementById("logRefresh");
  const exportBtn = document.getElementById("logExport");
  const startInput = document.getElementById("logStartDate");
  const endInput = document.getElementById("logEndDate");
  const rangeSelect = document.getElementById("logRange");
  const limitSelect = document.getElementById("logLimit");
  const clearBtn = document.getElementById("logClear");
  const pagePrevBtn = document.getElementById("logPagePrev");
  const pageNextBtn = document.getElementById("logPageNext");
  const pageInfo = document.getElementById("logPageInfo");
  const paginationWrap = document.getElementById("logPagination");

  if (!tableBody) {
    return;
  }

  const allowedPageSizes = new Set([5, 25, 50, 100, 250, 500]);
  let pageSize = normalizePageSize(limitSelect ? limitSelect.value : 25);
  let currentPage = 1;
  let cachedItems = [];
  let isFiltered = false;

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

  function normalizePageSize(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return 25;
    }
    if (!allowedPageSizes.has(parsed)) {
      return 25;
    }
    return parsed;
  }

  function getDateFilters() {
    const startDate = startInput ? startInput.value : "";
    const endDate = endInput ? endInput.value : "";
    if (startDate && endDate && startDate > endDate) {
      setNotice("Start date must be before end date.", "error");
      return null;
    }
    return { startDate, endDate };
  }

  function buildLogQuery({ startDate, endDate }) {
    const params = new URLSearchParams();
    if (startDate) {
      params.set("start_date", startDate);
    }
    if (endDate) {
      params.set("end_date", endDate);
    }
    return params.toString();
  }

  function buildExportFileName(startDate, endDate) {
    const parts = ["print_jobs"];
    if (startDate) {
      parts.push(startDate);
    }
    if (endDate) {
      parts.push(endDate);
    }
    return `${parts.join("_")}.csv`;
  }

  function getResponseFilename(response, fallback) {
    const header = response.headers.get("content-disposition");
    if (!header) {
      return fallback;
    }
    const match = header.match(/filename="?([^\";]+)"?/i);
    if (!match) {
      return fallback;
    }
    return match[1];
  }

  function downloadBlob(filename, blob) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
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

  function getTotalPages(total) {
    if (!total) {
      return 1;
    }
    return Math.max(1, Math.ceil(total / pageSize));
  }

  function updatePagination(total, startIndex, endIndex) {
    if (!paginationWrap) {
      return;
    }
    if (!total || total <= pageSize) {
      paginationWrap.hidden = true;
      if (pageInfo) {
        pageInfo.textContent = "";
      }
      return;
    }
    const totalPages = getTotalPages(total);
    paginationWrap.hidden = false;
    if (pageInfo) {
      pageInfo.textContent = `${startIndex + 1}-${endIndex} of ${total}`;
    }
    if (pagePrevBtn) {
      pagePrevBtn.disabled = currentPage <= 1;
    }
    if (pageNextBtn) {
      pageNextBtn.disabled = currentPage >= totalPages;
    }
  }

  function renderCurrentPage() {
    const total = cachedItems.length;
    if (!total) {
      renderRows([], isFiltered);
      updatePagination(0, 0, 0);
      return;
    }
    const totalPages = getTotalPages(total);
    if (currentPage > totalPages) {
      currentPage = totalPages;
    }
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, total);
    renderRows(cachedItems.slice(startIndex, endIndex), isFiltered);
    updatePagination(total, startIndex, endIndex);
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
    const filters = getDateFilters();
    if (!filters) {
      return;
    }
    const query = buildLogQuery(filters);
    const url = query ? `/api/print-jobs?${query}` : "/api/print-jobs";
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      setNotice("Failed to load logs.", "error");
      return;
    }
    const data = await res.json().catch(() => ({}));
    cachedItems = Array.isArray(data.items) ? data.items : [];
    isFiltered = Boolean(filters.startDate || filters.endDate);
    currentPage = 1;
    renderCurrentPage();
  }

  if (refreshBtn) {
    refreshBtn.addEventListener("click", loadLogs);
  }
  if (exportBtn) {
    exportBtn.addEventListener("click", async () => {
      setNotice("", "");
      const filters = getDateFilters();
      if (!filters) {
        return;
      }
      exportBtn.disabled = true;
      setNotice("Preparing export...", "success");
      try {
        const query = buildLogQuery(filters);
        const url = query ? `/api/print-jobs/export?${query}` : "/api/print-jobs/export";
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) {
          throw new Error("export_failed");
        }
        const blob = await res.blob();
        const fallbackName = buildExportFileName(filters.startDate, filters.endDate);
        const filename = getResponseFilename(res, fallbackName);
        downloadBlob(filename, blob);
        setNotice("Export ready.", "success");
      } catch (error) {
        setNotice("Failed to export logs.", "error");
      } finally {
        exportBtn.disabled = false;
      }
    });
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
  if (limitSelect) {
    limitSelect.addEventListener("change", () => {
      pageSize = normalizePageSize(limitSelect.value);
      currentPage = 1;
      renderCurrentPage();
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
  if (pagePrevBtn) {
    pagePrevBtn.addEventListener("click", () => {
      if (currentPage <= 1) {
        return;
      }
      currentPage -= 1;
      renderCurrentPage();
    });
  }
  if (pageNextBtn) {
    pageNextBtn.addEventListener("click", () => {
      const totalPages = getTotalPages(cachedItems.length);
      if (currentPage >= totalPages) {
        return;
      }
      currentPage += 1;
      renderCurrentPage();
    });
  }

  loadLogs();
});
