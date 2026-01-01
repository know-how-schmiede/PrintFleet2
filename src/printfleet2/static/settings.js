document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("settingsForm");
  const notice = document.getElementById("settingsNotice");
  const resetBtn = document.getElementById("settingsReset");
  const exportBtn = document.getElementById("settingsExport");
  const importBtn = document.getElementById("settingsImport");
  const importFile = document.getElementById("settingsImportFile");

  if (!form || !notice || !resetBtn) {
    return;
  }

  const fields = {
    poll_interval: "settingPollInterval",
    db_reload_interval: "settingReloadInterval",
    telegram_chat_id: "settingTelegramChatId",
    language: "settingLanguage",
    theme: "settingTheme",
    imprint_markdown: "settingImprint",
    privacy_markdown: "settingPrivacy",
    kiosk_stream_url: "settingKioskStreamUrl",
    kiosk_camera_host: "settingKioskCameraHost",
    kiosk_camera_user: "settingKioskCameraUser",
    kiosk_camera_password: "settingKioskCameraPassword",
    kiosk_stream_layout: "settingKioskLayout",
    kiosk_stream_url_1: "settingKioskStreamUrl1",
    kiosk_camera_host_1: "settingKioskCameraHost1",
    kiosk_camera_user_1: "settingKioskCameraUser1",
    kiosk_camera_password_1: "settingKioskCameraPassword1",
    kiosk_stream_active_1: "settingKioskStreamActive1",
    kiosk_stream_title_1: "settingKioskStreamTitle1",
    kiosk_stream_url_2: "settingKioskStreamUrl2",
    kiosk_camera_host_2: "settingKioskCameraHost2",
    kiosk_camera_user_2: "settingKioskCameraUser2",
    kiosk_camera_password_2: "settingKioskCameraPassword2",
    kiosk_stream_active_2: "settingKioskStreamActive2",
    kiosk_stream_title_2: "settingKioskStreamTitle2",
    kiosk_stream_url_3: "settingKioskStreamUrl3",
    kiosk_camera_host_3: "settingKioskCameraHost3",
    kiosk_camera_user_3: "settingKioskCameraUser3",
    kiosk_camera_password_3: "settingKioskCameraPassword3",
    kiosk_stream_active_3: "settingKioskStreamActive3",
    kiosk_stream_title_3: "settingKioskStreamTitle3",
    kiosk_stream_url_4: "settingKioskStreamUrl4",
    kiosk_camera_host_4: "settingKioskCameraHost4",
    kiosk_camera_user_4: "settingKioskCameraUser4",
    kiosk_camera_password_4: "settingKioskCameraPassword4",
    kiosk_stream_active_4: "settingKioskStreamActive4",
    kiosk_stream_title_4: "settingKioskStreamTitle4",
    live_wall_printer_columns: "settingLiveWallPrinterColumns",
    live_wall_printer_data: "settingLiveWallPrinterData",
    live_wall_plug_poll_interval: "settingLiveWallPlugPollInterval",
  };

  const numericFields = new Set(["poll_interval", "db_reload_interval", "live_wall_plug_poll_interval"]);
  const integerFields = {
    live_wall_printer_columns: { min: 1, max: 5 },
  };
  const numericBounds = {
    live_wall_plug_poll_interval: { min: 1, max: 300 },
  };
  const rtspStreams = [
    {
      index: 1,
      hostId: "settingKioskCameraHost1",
      userId: "settingKioskCameraUser1",
      passwordId: "settingKioskCameraPassword1",
      outputId: "settingKioskGeneratedRtsp1",
    },
    {
      index: 2,
      hostId: "settingKioskCameraHost2",
      userId: "settingKioskCameraUser2",
      passwordId: "settingKioskCameraPassword2",
      outputId: "settingKioskGeneratedRtsp2",
    },
    {
      index: 3,
      hostId: "settingKioskCameraHost3",
      userId: "settingKioskCameraUser3",
      passwordId: "settingKioskCameraPassword3",
      outputId: "settingKioskGeneratedRtsp3",
    },
    {
      index: 4,
      hostId: "settingKioskCameraHost4",
      userId: "settingKioskCameraUser4",
      passwordId: "settingKioskCameraPassword4",
      outputId: "settingKioskGeneratedRtsp4",
    },
  ];

  function setNotice(message, type) {
    notice.textContent = message;
    notice.className = "notice " + (type || "");
    if (!message) {
      notice.className = "notice";
    }
  }

  function setFieldValue(fieldId, value) {
    const field = document.getElementById(fieldId);
    if (!field) {
      return;
    }
    if (field.type === "checkbox") {
      field.checked = value === true || value === "true" || value === 1 || value === "1";
      return;
    }
    if (fieldId === "settingLiveWallPrinterColumns" && (value === null || value === undefined || value === "")) {
      field.value = "3";
      return;
    }
    if (fieldId === "settingLiveWallPrinterData" && (value === null || value === undefined || value === "")) {
      field.value = "normal";
      return;
    }
    if (fieldId === "settingLiveWallPlugPollInterval" && (value === null || value === undefined || value === "")) {
      field.value = "5";
      return;
    }
    field.value = value ?? "";
  }

  function readFieldValue(fieldId) {
    const field = document.getElementById(fieldId);
    if (!field) {
      return "";
    }
    return (field.value || "").trim();
  }

  function normalizeRtspHost(raw) {
    if (!raw) {
      return "";
    }
    let host = raw.trim();
    host = host.replace(/^rtsp:\/\//i, "");
    host = host.replace(/\/.*$/, "");
    if (/^\[.*\](?::\d+)?$/.test(host)) {
      if (/:\d+$/.test(host)) {
        return host;
      }
      return `${host}:554`;
    }
    if (/:\d+$/.test(host)) {
      return host;
    }
    return `${host}:554`;
  }

  function buildRtspUrl({ index, hostId, userId, passwordId }) {
    const rawHost = readFieldValue(hostId);
    if (!rawHost) {
      return "";
    }
    const lower = rawHost.toLowerCase();
    if (lower.startsWith("rtsp://")) {
      if (rawHost.includes("@")) {
        return rawHost;
      }
      const user = readFieldValue(userId);
      const password = readFieldValue(passwordId);
      if (user && password) {
        return `rtsp://${user}:${password}@${rawHost.slice(7)}`;
      }
      return rawHost;
    }
    let base = rawHost;
    let path = "/stream1";
    if (rawHost.includes("/")) {
      const parts = rawHost.split("/", 2);
      base = parts[0];
      path = `/${parts[1]}`;
    }
    if (base.includes("@")) {
      const [creds, hostPart] = base.split("@", 2);
      const normalized = normalizeRtspHost(hostPart);
      if (!normalized) {
        return "";
      }
      return `rtsp://${creds}@${normalized}${path}`;
    }
    const normalizedHost = normalizeRtspHost(base);
    if (!normalizedHost) {
      return "";
    }
    const user = readFieldValue(userId);
    const password = readFieldValue(passwordId);
    const credentials = user && password ? `${user}:${password}@` : "";
    return `rtsp://${credentials}${normalizedHost}${path}`;
  }

  function updateGeneratedRtspFields() {
    rtspStreams.forEach((stream) => {
      const output = document.getElementById(stream.outputId);
      if (!output) {
        return;
      }
      output.value = buildRtspUrl(stream);
    });
  }

  function bindRtspListeners() {
    rtspStreams.forEach((stream) => {
      [stream.hostId, stream.userId, stream.passwordId].forEach((fieldId) => {
        const field = document.getElementById(fieldId);
        if (!field) {
          return;
        }
        field.addEventListener("input", updateGeneratedRtspFields);
      });
    });
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

  function buildExportFileName() {
    const now = new Date();
    const pad = (value) => String(value).padStart(2, "0");
    return (
      "printfleet_settings_" +
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

  async function loadSettings() {
    setNotice("", "");
    const res = await fetch("/api/settings");
    if (!res.ok) {
      setNotice("Failed to load settings.", "error");
      return;
    }
    const data = await res.json();
    Object.entries(fields).forEach(([key, fieldId]) => {
      setFieldValue(fieldId, data[key]);
    });
    updateGeneratedRtspFields();
  }

  function buildPayload() {
    const payload = {};
    for (const [key, fieldId] of Object.entries(fields)) {
      const field = document.getElementById(fieldId);
      if (!field) {
        continue;
      }
      if (field.type === "checkbox") {
        payload[key] = field.checked;
        continue;
      }
      const rawValue = field.value;
      if (Object.prototype.hasOwnProperty.call(integerFields, key)) {
        const trimmed = rawValue.trim();
        if (!trimmed) {
          payload[key] = null;
          continue;
        }
        const parsed = Number(trimmed);
        const { min, max } = integerFields[key];
        if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
          return { error: `Invalid value for ${key.replace("_", " ")}.` };
        }
        payload[key] = parsed;
        continue;
      }
      if (numericFields.has(key)) {
        const trimmed = rawValue.trim();
        if (!trimmed) {
          payload[key] = null;
          continue;
        }
        const parsed = Number(trimmed);
        if (Number.isNaN(parsed) || parsed < 0) {
          return { error: `Invalid value for ${key.replace("_", " ")}.` };
        }
        if (Object.prototype.hasOwnProperty.call(numericBounds, key)) {
          const { min, max } = numericBounds[key];
          if (parsed < min || parsed > max) {
            return { error: `Invalid value for ${key.replace("_", " ")}.` };
          }
        }
        payload[key] = parsed;
        continue;
      }
      const value = rawValue.trim();
      payload[key] = value ? value : null;
    }
    return { payload };
  }

  function extractImportSettings(payload) {
    if (!payload || typeof payload !== "object") {
      return null;
    }
    if (payload.settings && typeof payload.settings === "object") {
      return payload.settings;
    }
    return payload;
  }

  function applyImportSettings(settings) {
    let applied = 0;
    Object.entries(fields).forEach(([key, fieldId]) => {
      if (Object.prototype.hasOwnProperty.call(settings, key)) {
        setFieldValue(fieldId, settings[key]);
        applied += 1;
      }
    });
    updateGeneratedRtspFields();
    return applied;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const { payload, error } = buildPayload();
    if (error) {
      setNotice(error, "error");
      return;
    }
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setNotice(data.error || "Failed to save settings.", "error");
      return;
    }
    const data = await res.json().catch(() => ({}));
    Object.entries(fields).forEach(([key, fieldId]) => {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        setFieldValue(fieldId, data[key]);
      }
    });
    updateGeneratedRtspFields();
    setNotice("Settings saved.", "success");
  });

  resetBtn.addEventListener("click", () => {
    loadSettings();
  });

  if (exportBtn) {
    exportBtn.addEventListener("click", async () => {
      exportBtn.disabled = true;
      setNotice("Preparing settings export...", "success");
      try {
        const res = await fetch("/api/settings");
        if (!res.ok) {
          throw new Error("export_failed");
        }
        const data = await res.json().catch(() => ({}));
        downloadJson(buildExportFileName(), {
          exported_at: new Date().toISOString(),
          settings: data,
        });
        setNotice("Settings exported.", "success");
      } catch (error) {
        setNotice("Failed to export settings.", "error");
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
      const settings = extractImportSettings(payload);
      if (!settings) {
        setNotice("JSON must contain settings data.", "error");
        return;
      }
      const applied = applyImportSettings(settings);
      if (!applied) {
        setNotice("No matching settings found in JSON.", "error");
        return;
      }
      if (!confirm("Import settings? This will overwrite current settings.")) {
        return;
      }
      const { payload: importPayload, error } = buildPayload();
      if (error) {
        setNotice(error, "error");
        return;
      }
      importBtn.disabled = true;
      setNotice("Importing settings...", "success");
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(importPayload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setNotice(data.error || "Failed to import settings.", "error");
        importBtn.disabled = false;
        return;
      }
      const data = await res.json().catch(() => ({}));
      Object.entries(fields).forEach(([key, fieldId]) => {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
          setFieldValue(fieldId, data[key]);
        }
      });
      setNotice("Settings imported.", "success");
      importBtn.disabled = false;
    });
  }

  bindRtspListeners();
  loadSettings();
});
