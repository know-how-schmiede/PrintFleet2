document.addEventListener("DOMContentLoaded", () => {
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

  if (!typeForm || !typeNameField || !typeTable) {
    return;
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
});
