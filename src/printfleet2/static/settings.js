document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("settingsForm");
  const notice = document.getElementById("settingsNotice");
  const resetBtn = document.getElementById("settingsReset");
  const exportBtn = document.getElementById("settingsExport");
  const importBtn = document.getElementById("settingsImport");
  const importFile = document.getElementById("settingsImportFile");
  const groupForm = document.getElementById("printerGroupForm");
  const groupNotice = document.getElementById("printerGroupNotice");
  const groupIdField = document.getElementById("printerGroupId");
  const groupNameField = document.getElementById("printerGroupName");
  const groupDescriptionField = document.getElementById("printerGroupDescription");
  const groupResetBtn = document.getElementById("printerGroupReset");
  const groupSubmitBtn = document.getElementById("printerGroupSubmit");
  const groupTable = document.getElementById("printerGroupTable");
  const typeForm = document.getElementById("printerTypeForm");
  const typeNotice = document.getElementById("printerTypeNotice");
  const typeIdField = document.getElementById("printerTypeId");
  const typeNameField = document.getElementById("printerTypeName");
  const typeKindField = document.getElementById("printerTypeKind");
  const typeManufacturerField = document.getElementById("printerTypeManufacturer");
  const typeGcodePrefixField = document.getElementById("printerTypeGcodePrefix");
  const typeBedSizeField = document.getElementById("printerTypeBedSize");
  const typeActiveField = document.getElementById("printerTypeActive");
  const typeUploadGcodeField = document.getElementById("printerTypeUploadGcode");
  const typeNotesField = document.getElementById("printerTypeNotes");
  const typeResetBtn = document.getElementById("printerTypeReset");
  const typeSubmitBtn = document.getElementById("printerTypeSubmit");
  const typeTable = document.getElementById("printerTypeTable");
  const typeExportBtn = document.getElementById("printerTypeExport");
  const typeImportBtn = document.getElementById("printerTypeImport");
  const typeImportFile = document.getElementById("printerTypeImportFile");

  if (!form || !notice || !resetBtn) {
    return;
  }

  const tabButtons = Array.from(document.querySelectorAll("[data-settings-tab]"));
  const tabPanels = Array.from(document.querySelectorAll("[data-settings-panel]"));

  function activateTab(targetId) {
    tabButtons.forEach((button) => {
      const isActive = button.dataset.settingsTab === targetId;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-selected", isActive ? "true" : "false");
      button.tabIndex = isActive ? 0 : -1;
    });
    tabPanels.forEach((panel) => {
      const isActive = panel.id === targetId;
      panel.classList.toggle("is-active", isActive);
      panel.hidden = !isActive;
    });
  }

  if (tabButtons.length && tabPanels.length) {
    tabButtons.forEach((button) => {
      button.addEventListener("click", () => {
        activateTab(button.dataset.settingsTab);
      });
    });
    const initialTab =
      tabButtons.find((button) => button.classList.contains("is-active"))?.dataset.settingsTab ||
      tabButtons[0].dataset.settingsTab;
    activateTab(initialTab);
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

  function setGroupNotice(message, type) {
    if (!groupNotice) {
      return;
    }
    groupNotice.textContent = message;
    groupNotice.className = "notice " + (type || "");
    if (!message) {
      groupNotice.className = "notice";
    }
  }

  function setTypeNotice(message, type) {
    if (!typeNotice) {
      return;
    }
    typeNotice.textContent = message;
    typeNotice.className = "notice " + (type || "");
    if (!message) {
      typeNotice.className = "notice";
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

  function buildPrinterTypeExportFileName() {
    const now = new Date();
    const pad = (value) => String(value).padStart(2, "0");
    return (
      "printfleet_printer_types_" +
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

  function extractImportPrinterTypes(payload) {
    if (Array.isArray(payload)) {
      return payload;
    }
    if (payload && Array.isArray(payload.items)) {
      return payload.items;
    }
    if (payload && Array.isArray(payload.printer_types)) {
      return payload.printer_types;
    }
    if (payload && Array.isArray(payload.types)) {
      return payload.types;
    }
    return null;
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

  if (groupForm && groupNameField && groupDescriptionField && groupTable) {
    function normalizeGroupName(value) {
      if (typeof value !== "string") {
        return "";
      }
      return value.trim();
    }

    function fillGroupForm(group) {
      if (!group) {
        return;
      }
      if (groupIdField) {
        groupIdField.value = group.id || "";
      }
      groupNameField.value = group.name || "";
      groupDescriptionField.value = group.description || "";
      if (groupSubmitBtn) {
        groupSubmitBtn.textContent = "Save group";
      }
    }

    function clearGroupForm(options) {
      const keepNotice = options && options.keepNotice;
      if (groupIdField) {
        groupIdField.value = "";
      }
      groupNameField.value = "";
      groupDescriptionField.value = "";
      if (groupSubmitBtn) {
        groupSubmitBtn.textContent = "Create group";
      }
      if (!keepNotice) {
        setGroupNotice("", "");
      }
    }

    function renderGroupTable(items) {
      groupTable.innerHTML = "";
      if (!items.length) {
        groupTable.innerHTML = "<tr><td colspan=\"3\" class=\"muted\">No groups yet.</td></tr>";
        return;
      }
      items.forEach((group) => {
        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${group.name}</td>
          <td>${group.description || "-"}</td>
          <td>
            <button class="btn small" data-action="edit" type="button">Edit</button>
            <button class="btn small danger" data-action="delete" type="button">Delete</button>
          </td>
        `;
        const editBtn = row.querySelector('[data-action="edit"]');
        const deleteBtn = row.querySelector('[data-action="delete"]');
        if (editBtn) {
          editBtn.addEventListener("click", () => fillGroupForm(group));
        }
        if (deleteBtn) {
          deleteBtn.addEventListener("click", async () => {
            if (!confirm(`Delete group ${group.name}?`)) {
              return;
            }
            const res = await fetch(`/api/printer-groups/${group.id}`, { method: "DELETE" });
            if (!res.ok) {
              setGroupNotice("Failed to delete group.", "error");
              return;
            }
            const data = await res.json().catch(() => ({}));
            const cleared = Number(data.cleared_printers || 0);
            if (groupIdField && groupIdField.value && Number(groupIdField.value) === group.id) {
              clearGroupForm({ keepNotice: true });
            }
            setGroupNotice(
              cleared ? `Group deleted. ${cleared} printer(s) cleared.` : "Group deleted.",
              "success"
            );
            loadPrinterGroups();
          });
        }
        groupTable.appendChild(row);
      });
    }

    async function loadPrinterGroups() {
      setGroupNotice("", "");
      const res = await fetch("/api/printer-groups");
      if (!res.ok) {
        setGroupNotice("Failed to load groups.", "error");
        return;
      }
      const data = await res.json().catch(() => ({}));
      const items = Array.isArray(data.items) ? data.items : [];
      renderGroupTable(items);
    }

    groupForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const name = normalizeGroupName(groupNameField.value);
      if (!name) {
        setGroupNotice("Group name is required.", "error");
        return;
      }
      const payload = {
        name,
        description: groupDescriptionField.value.trim() || null,
      };
      const groupId = groupIdField && groupIdField.value ? Number(groupIdField.value) : null;
      const method = groupId ? "PATCH" : "POST";
      const url = groupId ? `/api/printer-groups/${groupId}` : "/api/printer-groups";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const message = data.error === "name_exists" ? "Group name already exists." : "Failed to save group.";
        setGroupNotice(message, "error");
        return;
      }
      clearGroupForm({ keepNotice: true });
      setGroupNotice(groupId ? "Group updated." : "Group created.", "success");
      loadPrinterGroups();
    });

    if (groupResetBtn) {
      groupResetBtn.addEventListener("click", () => clearGroupForm());
    }

    clearGroupForm({ keepNotice: true });
    loadPrinterGroups();
  }

  if (typeForm && typeNameField && typeTable) {
    function normalizeTypeName(value) {
      if (typeof value !== "string") {
        return "";
      }
      return value.trim();
    }

    function fillTypeForm(printerType) {
      if (!printerType) {
        return;
      }
      if (typeIdField) {
        typeIdField.value = printerType.id || "";
      }
      typeNameField.value = printerType.name || "";
      if (typeKindField) {
        typeKindField.value = printerType.type_kind || "";
      }
      if (typeManufacturerField) {
        typeManufacturerField.value = printerType.manufacturer || "";
      }
      if (typeGcodePrefixField) {
        typeGcodePrefixField.value = printerType.gcode_prefix || "";
      }
      if (typeBedSizeField) {
        typeBedSizeField.value = printerType.bed_size || "";
      }
      if (typeNotesField) {
        typeNotesField.value = printerType.notes || "";
      }
      if (typeActiveField) {
        typeActiveField.checked = printerType.active !== false;
      }
      if (typeUploadGcodeField) {
        typeUploadGcodeField.checked = printerType.upload_gcode_active === true;
      }
      if (typeSubmitBtn) {
        typeSubmitBtn.textContent = "Save type";
      }
    }

    function clearTypeForm(options) {
      const keepNotice = options && options.keepNotice;
      if (typeIdField) {
        typeIdField.value = "";
      }
      typeNameField.value = "";
      if (typeKindField) {
        typeKindField.value = "";
      }
      if (typeManufacturerField) {
        typeManufacturerField.value = "";
      }
      if (typeGcodePrefixField) {
        typeGcodePrefixField.value = "";
      }
      if (typeBedSizeField) {
        typeBedSizeField.value = "";
      }
      if (typeNotesField) {
        typeNotesField.value = "";
      }
      if (typeActiveField) {
        typeActiveField.checked = true;
      }
      if (typeUploadGcodeField) {
        typeUploadGcodeField.checked = false;
      }
      if (typeSubmitBtn) {
        typeSubmitBtn.textContent = "Create type";
      }
      if (!keepNotice) {
        setTypeNotice("", "");
      }
    }

    function renderTypeTable(items) {
      typeTable.innerHTML = "";
      if (!items.length) {
        typeTable.innerHTML = "<tr><td colspan=\"9\" class=\"muted\">No types yet.</td></tr>";
        return;
      }
      items.forEach((printerType) => {
        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${printerType.name}</td>
          <td>${printerType.type_kind || "-"}</td>
          <td>${printerType.manufacturer || "-"}</td>
          <td>${printerType.gcode_prefix || "-"}</td>
          <td>${printerType.bed_size || "-"}</td>
          <td>${printerType.upload_gcode_active ? "Yes" : "No"}</td>
          <td>${printerType.active ? "Yes" : "No"}</td>
          <td>${printerType.notes || "-"}</td>
          <td>
            <button class="btn small" data-action="edit" type="button">Edit</button>
            <button class="btn small danger" data-action="delete" type="button">Delete</button>
          </td>
        `;
        const editBtn = row.querySelector('[data-action="edit"]');
        const deleteBtn = row.querySelector('[data-action="delete"]');
        if (editBtn) {
          editBtn.addEventListener("click", () => fillTypeForm(printerType));
        }
        if (deleteBtn) {
          deleteBtn.addEventListener("click", async () => {
            if (!confirm(`Delete type ${printerType.name}?`)) {
              return;
            }
            const res = await fetch(`/api/printer-types/${printerType.id}`, { method: "DELETE" });
            if (!res.ok) {
              setTypeNotice("Failed to delete type.", "error");
              return;
            }
            if (typeIdField && typeIdField.value && Number(typeIdField.value) === printerType.id) {
              clearTypeForm({ keepNotice: true });
            }
            setTypeNotice("Type deleted.", "success");
            loadPrinterTypes();
          });
        }
        typeTable.appendChild(row);
      });
    }

    async function loadPrinterTypes() {
      setTypeNotice("", "");
      const res = await fetch("/api/printer-types");
      if (!res.ok) {
        setTypeNotice("Failed to load types.", "error");
        return;
      }
      const data = await res.json().catch(() => ({}));
      const items = Array.isArray(data.items) ? data.items : [];
      renderTypeTable(items);
    }

    typeForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const name = normalizeTypeName(typeNameField.value);
      if (!name) {
        setTypeNotice("Type name is required.", "error");
        return;
      }
      const payload = {
        name,
        type_kind: typeKindField ? typeKindField.value || null : null,
        manufacturer: typeManufacturerField ? typeManufacturerField.value.trim() || null : null,
        gcode_prefix: typeGcodePrefixField ? typeGcodePrefixField.value.trim() || null : null,
        bed_size: typeBedSizeField ? typeBedSizeField.value.trim() || null : null,
        active: typeActiveField ? typeActiveField.checked : true,
        upload_gcode_active: typeUploadGcodeField ? typeUploadGcodeField.checked : false,
        notes: typeNotesField ? typeNotesField.value.trim() || null : null,
      };
      const typeId = typeIdField && typeIdField.value ? Number(typeIdField.value) : null;
      const method = typeId ? "PATCH" : "POST";
      const url = typeId ? `/api/printer-types/${typeId}` : "/api/printer-types";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const message = data.error === "name_exists" ? "Type name already exists." : "Failed to save type.";
        setTypeNotice(message, "error");
        return;
      }
      clearTypeForm({ keepNotice: true });
      setTypeNotice(typeId ? "Type updated." : "Type created.", "success");
      loadPrinterTypes();
    });

    if (typeResetBtn) {
      typeResetBtn.addEventListener("click", () => clearTypeForm());
    }

    if (typeExportBtn) {
      typeExportBtn.addEventListener("click", async () => {
        typeExportBtn.disabled = true;
        setTypeNotice("Preparing printer type export...", "success");
        try {
          const res = await fetch("/api/printer-types/export");
          if (!res.ok) {
            throw new Error("export_failed");
          }
          const data = await res.json().catch(() => ({}));
          const items = Array.isArray(data.items) ? data.items : [];
          downloadJson(buildPrinterTypeExportFileName(), {
            exported_at: data.exported_at || new Date().toISOString(),
            app_version: data.app_version || null,
            items,
          });
          setTypeNotice(`Exported ${items.length} printer type(s).`, "success");
        } catch (error) {
          setTypeNotice("Failed to export printer types.", "error");
        } finally {
          typeExportBtn.disabled = false;
        }
      });
    }

    if (typeImportBtn && typeImportFile) {
      typeImportBtn.addEventListener("click", () => typeImportFile.click());
      typeImportFile.addEventListener("change", async () => {
        const file = typeImportFile.files && typeImportFile.files[0];
        typeImportFile.value = "";
        if (!file) {
          return;
        }
        let payload;
        try {
          const text = await file.text();
          payload = JSON.parse(text);
        } catch (error) {
          setTypeNotice("Invalid JSON file.", "error");
          return;
        }
        const items = extractImportPrinterTypes(payload);
        if (!items) {
          setTypeNotice("JSON must contain printer types.", "error");
          return;
        }
        if (!items.length) {
          setTypeNotice("No printer types found in JSON.", "error");
          return;
        }
        if (!confirm(`Import ${items.length} printer type(s)? Existing names will be updated.`)) {
          return;
        }
        typeImportBtn.disabled = true;
        setTypeNotice(`Importing ${items.length} printer type(s)...`, "success");
        try {
          const res = await fetch("/api/printer-types/import", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ items }),
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            setTypeNotice(data.error || "Failed to import printer types.", "error");
            typeImportBtn.disabled = false;
            return;
          }
          const data = await res.json().catch(() => ({}));
          const created = Number(data.created) || 0;
          const updated = Number(data.updated) || 0;
          const skipped = Number(data.skipped) || 0;
          const invalid = Number(data.invalid) || 0;
          setTypeNotice(
            `Import complete: ${created} created, ${updated} updated, ${skipped} skipped, ${invalid} invalid.`,
            "success"
          );
          typeImportBtn.disabled = false;
          loadPrinterTypes();
        } catch (error) {
          setTypeNotice("Failed to import printer types.", "error");
          typeImportBtn.disabled = false;
        }
      });
    }

    clearTypeForm({ keepNotice: true });
    loadPrinterTypes();
  }
});
