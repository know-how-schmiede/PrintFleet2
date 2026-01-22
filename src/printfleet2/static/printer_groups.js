document.addEventListener("DOMContentLoaded", () => {
  const groupForm = document.getElementById("printerGroupForm");
  const groupNotice = document.getElementById("printerGroupNotice");
  const groupIdField = document.getElementById("printerGroupId");
  const groupNameField = document.getElementById("printerGroupName");
  const groupTypeField = document.getElementById("printerGroupType");
  const groupDescriptionField = document.getElementById("printerGroupDescription");
  const groupResetBtn = document.getElementById("printerGroupReset");
  const groupSubmitBtn = document.getElementById("printerGroupSubmit");
  const groupTable = document.getElementById("printerGroupTable");
  const groupExportBtn = document.getElementById("printerGroupExport");
  const groupImportBtn = document.getElementById("printerGroupImport");
  const groupImportFile = document.getElementById("printerGroupImportFile");

  if (!groupForm || !groupNameField || !groupDescriptionField || !groupTable) {
    return;
  }

  let printerTypesCache = [];

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

  function normalizeGroupName(value) {
    if (typeof value !== "string") {
      return "";
    }
    return value.trim();
  }

  function normalizeGroupType(value) {
    if (typeof value !== "string") {
      return "";
    }
    return value.trim();
  }

  function renderTypeOptions(selectedValue) {
    if (!groupTypeField) {
      return;
    }
    const currentValue =
      selectedValue !== undefined ? selectedValue : groupTypeField.value;
    groupTypeField.innerHTML = "";
    const emptyOption = document.createElement("option");
    emptyOption.value = "";
    emptyOption.textContent = "No type";
    groupTypeField.appendChild(emptyOption);
    printerTypesCache.forEach((printerType) => {
      const option = document.createElement("option");
      option.value = printerType.name;
      if (printerType.active === false) {
        option.disabled = true;
        option.textContent = `${printerType.name} (inactive)`;
      } else {
        option.textContent = printerType.name;
      }
      groupTypeField.appendChild(option);
    });
    const normalized =
      currentValue !== null && currentValue !== undefined ? String(currentValue) : "";
    if (normalized && !groupTypeField.querySelector(`option[value="${normalized}"]`)) {
      const option = document.createElement("option");
      option.value = normalized;
      option.textContent = `${normalized} (missing)`;
      groupTypeField.appendChild(option);
    }
    groupTypeField.value = normalized;
  }

  async function loadPrinterTypes(selectedValue) {
    if (!groupTypeField) {
      return;
    }
    try {
      const res = await fetch("/api/printer-types");
      if (!res.ok) {
        throw new Error("types_failed");
      }
      const data = await res.json().catch(() => ({}));
      printerTypesCache = Array.isArray(data.items) ? data.items : [];
      renderTypeOptions(selectedValue);
    } catch (error) {
      // ignore type load failures
    }
  }

  function fillGroupForm(group) {
    if (!group) {
      return;
    }
    if (groupIdField) {
      groupIdField.value = group.id || "";
    }
    groupNameField.value = group.name || "";
    if (groupTypeField) {
      if (printerTypesCache.length) {
        renderTypeOptions(group.printer_type || "");
      } else {
        loadPrinterTypes(group.printer_type || "");
      }
    }
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
    if (groupTypeField) {
      if (printerTypesCache.length) {
        renderTypeOptions("");
      } else {
        loadPrinterTypes("");
      }
    }
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

  function buildPrinterGroupExportFileName() {
    const now = new Date();
    const pad = (value) => String(value).padStart(2, "0");
    return (
      "printfleet_printer_groups_" +
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

  function extractImportPrinterGroups(payload) {
    if (Array.isArray(payload)) {
      return payload;
    }
    if (payload && Array.isArray(payload.items)) {
      return payload.items;
    }
    if (payload && Array.isArray(payload.printer_groups)) {
      return payload.printer_groups;
    }
    if (payload && Array.isArray(payload.groups)) {
      return payload.groups;
    }
    return null;
  }

  groupForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = normalizeGroupName(groupNameField.value);
    if (!name) {
      setGroupNotice("Group name is required.", "error");
      return;
    }
    const printerTypeValue = groupTypeField ? normalizeGroupType(groupTypeField.value) : "";
    const payload = {
      name,
      description: groupDescriptionField.value.trim() || null,
    };
    if (groupTypeField) {
      payload.printer_type = printerTypeValue || null;
    }
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

  if (groupExportBtn) {
    groupExportBtn.addEventListener("click", async () => {
      groupExportBtn.disabled = true;
      setGroupNotice("Preparing group export...", "success");
      try {
        const res = await fetch("/api/printer-groups/export");
        if (!res.ok) {
          throw new Error("export_failed");
        }
        const data = await res.json().catch(() => ({}));
        const items = Array.isArray(data.items) ? data.items : [];
        downloadJson(buildPrinterGroupExportFileName(), {
          exported_at: data.exported_at || new Date().toISOString(),
          app_version: data.app_version || null,
          items,
        });
        setGroupNotice(`Exported ${items.length} group(s).`, "success");
      } catch (error) {
        setGroupNotice("Failed to export groups.", "error");
      } finally {
        groupExportBtn.disabled = false;
      }
    });
  }

  if (groupImportBtn && groupImportFile) {
    groupImportBtn.addEventListener("click", () => groupImportFile.click());
    groupImportFile.addEventListener("change", async () => {
      const file = groupImportFile.files && groupImportFile.files[0];
      groupImportFile.value = "";
      if (!file) {
        return;
      }
      let payload;
      try {
        const text = await file.text();
        payload = JSON.parse(text);
      } catch (error) {
        setGroupNotice("Invalid JSON file.", "error");
        return;
      }
      const items = extractImportPrinterGroups(payload);
      if (!items) {
        setGroupNotice("JSON must contain printer groups.", "error");
        return;
      }
      if (!items.length) {
        setGroupNotice("No printer groups found in JSON.", "error");
        return;
      }
      if (!confirm(`Import ${items.length} printer group(s)? Existing names will be updated.`)) {
        return;
      }
      groupImportBtn.disabled = true;
      setGroupNotice(`Importing ${items.length} printer group(s)...`, "success");
      try {
        const res = await fetch("/api/printer-groups/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setGroupNotice(data.error || "Failed to import groups.", "error");
          groupImportBtn.disabled = false;
          return;
        }
        const data = await res.json().catch(() => ({}));
        const created = Number(data.created) || 0;
        const updated = Number(data.updated) || 0;
        const skipped = Number(data.skipped) || 0;
        const invalid = Number(data.invalid) || 0;
        setGroupNotice(
          `Import complete: ${created} created, ${updated} updated, ${skipped} skipped, ${invalid} invalid.`,
          "success"
        );
        groupImportBtn.disabled = false;
        loadPrinterGroups();
      } catch (error) {
        setGroupNotice("Failed to import groups.", "error");
        groupImportBtn.disabled = false;
      }
    });
  }

  clearGroupForm({ keepNotice: true });
  loadPrinterGroups();
  loadPrinterTypes();
});
