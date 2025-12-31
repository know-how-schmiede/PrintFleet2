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
    kiosk_stream_url_2: "settingKioskStreamUrl2",
    kiosk_camera_host_2: "settingKioskCameraHost2",
    kiosk_camera_user_2: "settingKioskCameraUser2",
    kiosk_camera_password_2: "settingKioskCameraPassword2",
    kiosk_stream_url_3: "settingKioskStreamUrl3",
    kiosk_camera_host_3: "settingKioskCameraHost3",
    kiosk_camera_user_3: "settingKioskCameraUser3",
    kiosk_camera_password_3: "settingKioskCameraPassword3",
    kiosk_stream_url_4: "settingKioskStreamUrl4",
    kiosk_camera_host_4: "settingKioskCameraHost4",
    kiosk_camera_user_4: "settingKioskCameraUser4",
    kiosk_camera_password_4: "settingKioskCameraPassword4",
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
  }

  function buildPayload() {
    const payload = {};
    for (const [key, fieldId] of Object.entries(fields)) {
      const field = document.getElementById(fieldId);
      if (!field) {
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

  loadSettings();
});
