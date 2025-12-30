document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("settingsForm");
  const notice = document.getElementById("settingsNotice");
  const resetBtn = document.getElementById("settingsReset");

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
  };

  const numericFields = new Set(["poll_interval", "db_reload_interval"]);

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
    field.value = value ?? "";
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
        payload[key] = parsed;
        continue;
      }
      const value = rawValue.trim();
      payload[key] = value ? value : null;
    }
    return { payload };
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

  loadSettings();
});
