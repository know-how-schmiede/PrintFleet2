document.addEventListener("DOMContentLoaded", () => {
  const printerCards = Array.from(document.querySelectorAll(".live-wall-printer[data-printer-id]"));
  if (!printerCards.length) {
    return;
  }

  const cardMap = new Map();
  printerCards.forEach((card) => {
    const id = Number(card.dataset.printerId);
    if (!Number.isNaN(id)) {
      cardMap.set(id, card);
    }
  });

  const statusUrl = "/api/live-wall/status";
  const plugStatusUrl = "/api/live-wall/plug-status";
  const wall = document.querySelector(".live-wall");
  const statusIntervalValue = wall ? Number(wall.dataset.statusPollInterval) : NaN;
  const plugIntervalValue = wall ? Number(wall.dataset.plugPollInterval) : NaN;
  const statusPollIntervalMs = Number.isFinite(statusIntervalValue) && statusIntervalValue > 0
    ? Math.round(statusIntervalValue * 1000)
    : 5000;
  const plugPollIntervalMs = Number.isFinite(plugIntervalValue) && plugIntervalValue > 0
    ? Math.round(plugIntervalValue * 1000)
    : 5000;

  function formatTemp(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) {
      return "--";
    }
    return number.toFixed(1);
  }

  function formatPercent(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) {
      return "--";
    }
    return Math.round(number).toString();
  }

  function formatDuration(value) {
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

  function updateCard(card, status) {
    const statusEl = card.querySelector("[data-printer-status]");
    if (statusEl) {
      statusEl.textContent = status.status || "Unknown";
      statusEl.className = "printer-status status-" + (status.status_state || "muted");
    }


    const tempsEl = card.querySelector("[data-printer-temps]");
    if (tempsEl) {
      const hotend = formatTemp(status.temp_hotend);
      const bed = formatTemp(status.temp_bed);
      tempsEl.textContent = `Hotend ${hotend} C / Bed ${bed} C`;
    }

    const jobEl = card.querySelector("[data-printer-job]");
    if (jobEl) {
      jobEl.textContent = `Job: ${status.job_name || "--"}`;
    }

    const progressEl = card.querySelector("[data-printer-progress]");
    if (progressEl) {
      progressEl.textContent = `Progress: ${formatPercent(status.progress)}%`;
    }

    const timesEl = card.querySelector("[data-printer-times]");
    if (timesEl) {
      const elapsed = formatDuration(status.elapsed);
      const remaining = formatDuration(status.remaining);
      timesEl.textContent = `Elapsed ${elapsed} - Remaining ${remaining}`;
    }

    const errorBtn = card.querySelector("[data-error-toggle]");
    const errorDetails = card.querySelector("[data-error-details]");
    if (errorBtn && errorDetails) {
      const message = status.error_message;
      if (message) {
        errorBtn.hidden = false;
        errorDetails.textContent = message;
        const open = errorBtn.dataset.open === "true";
        errorDetails.hidden = !open;
        errorBtn.textContent = open ? "Hide Details" : "Show Details";
      } else {
        errorBtn.hidden = true;
        errorBtn.dataset.open = "false";
        errorBtn.textContent = "Show Details";
        errorDetails.hidden = true;
        errorDetails.textContent = "";
      }
    }
  }

  function updatePlug(card, status) {
    const plugEl = card.querySelector("[data-plug-status]");
    if (!plugEl) {
      return;
    }
    const label = status.plug_label;
    const labelEl = plugEl.querySelector("[data-plug-label]");
    if (label) {
      const displayLabel = label.replace(/^Plug\s+/i, "") || label;
      plugEl.hidden = false;
      if (labelEl) {
        labelEl.textContent = displayLabel;
      } else {
        plugEl.textContent = displayLabel;
      }
      plugEl.className = "plug-status status-" + (status.plug_state || "muted");
    } else {
      plugEl.hidden = true;
      if (labelEl) {
        labelEl.textContent = "";
      } else {
        plugEl.textContent = "";
      }
      plugEl.className = "plug-status status-muted";
    }
  }

  printerCards.forEach((card) => {
    const errorBtn = card.querySelector("[data-error-toggle]");
    const errorDetails = card.querySelector("[data-error-details]");
    if (!errorBtn || !errorDetails) {
      return;
    }
    errorBtn.addEventListener("click", () => {
      const open = errorBtn.dataset.open === "true";
      errorBtn.dataset.open = open ? "false" : "true";
      errorDetails.hidden = open;
      errorBtn.textContent = open ? "Show Details" : "Hide Details";
    });
  });

  async function refreshStatuses() {
    try {
      const res = await fetch(statusUrl, { cache: "no-store" });
      if (!res.ok) {
        return;
      }
      const data = await res.json().catch(() => ({}));
      const items = data.items || [];
      items.forEach((item) => {
        const card = cardMap.get(Number(item.id));
        if (card) {
          updateCard(card, item);
        }
      });
    } catch (error) {
      // Keep the last known values on network errors.
    }
  }

  async function refreshPlugStatuses() {
    try {
      const res = await fetch(plugStatusUrl, { cache: "no-store" });
      if (!res.ok) {
        return;
      }
      const data = await res.json().catch(() => ({}));
      const items = data.items || [];
      items.forEach((item) => {
        const card = cardMap.get(Number(item.id));
        if (card) {
          updatePlug(card, item);
        }
      });
    } catch (error) {
      // Keep the last known values on network errors.
    }
  }

  refreshStatuses();
  refreshPlugStatuses();
  setInterval(refreshStatuses, statusPollIntervalMs);
  setInterval(refreshPlugStatuses, plugPollIntervalMs);
});
