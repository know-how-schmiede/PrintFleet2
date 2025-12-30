document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("userForm");
  const notice = document.getElementById("userNotice");
  const formTitle = document.getElementById("userFormTitle");
  const formHint = document.getElementById("userFormHint");
  const submitBtn = document.getElementById("userSubmit");
  const resetBtn = document.getElementById("userReset");
  const refreshBtn = document.getElementById("userRefresh");
  const roleField = document.getElementById("userRole");
  const firstUser = form?.dataset.firstUser === "true";
  const passwordField = document.getElementById("userPassword");
  const userIdField = document.getElementById("userId");
  const userCache = new Map();
  let editingUserId = null;

  if (!form || !notice || !resetBtn || !refreshBtn) {
    return;
  }

  function setNotice(message, type) {
    notice.textContent = message;
    notice.className = "notice " + (type || "");
    if (!message) {
      notice.className = "notice";
    }
  }

  function clearForm(keepNotice) {
    editingUserId = null;
    if (userIdField) {
      userIdField.value = "";
    }
    document.getElementById("userName").value = "";
    document.getElementById("userPassword").value = "";
    document.getElementById("userFirstName").value = "";
    document.getElementById("userLastName").value = "";
    document.getElementById("userEmail").value = "";
    document.getElementById("userNotes").value = "";
    if (roleField && roleField.tagName === "SELECT") {
      roleField.value = "user";
    }
    if (passwordField) {
      passwordField.required = true;
      passwordField.placeholder = "";
    }
    if (formTitle) {
      formTitle.textContent = "Create user";
    }
    if (formHint) {
      formHint.textContent = "Username and password are required.";
    }
    if (resetBtn) {
      resetBtn.textContent = "Clear";
    }
    if (submitBtn) {
      submitBtn.textContent = "Create user";
    }
    if (!keepNotice) {
      setNotice("", "");
    }
  }

  function setEditing(user) {
    editingUserId = user.id;
    if (userIdField) {
      userIdField.value = String(user.id);
    }
    document.getElementById("userName").value = user.username || "";
    document.getElementById("userFirstName").value = user.first_name || "";
    document.getElementById("userLastName").value = user.last_name || "";
    document.getElementById("userEmail").value = user.email || "";
    document.getElementById("userNotes").value = user.notes || "";
    if (roleField && roleField.tagName === "SELECT") {
      roleField.value = user.role || "user";
    }
    if (passwordField) {
      passwordField.required = false;
      passwordField.value = "";
      passwordField.placeholder = "Leave blank to keep password";
    }
    if (formTitle) {
      formTitle.textContent = "Edit user";
    }
    if (formHint) {
      formHint.textContent = "Username is required. Leave password blank to keep it.";
    }
    if (resetBtn) {
      resetBtn.textContent = "Cancel edit";
    }
    if (submitBtn) {
      submitBtn.textContent = "Save user";
    }
    setNotice("", "");
  }

  function formatRole(role) {
    if (!role) {
      return "User";
    }
    if (role === "superadmin") {
      return "SuperAdmin";
    }
    return role.charAt(0).toUpperCase() + role.slice(1);
  }

  async function loadUsers() {
    const res = await fetch("/api/users");
    const data = res.ok ? await res.json() : { items: [] };
    if (!res.ok) {
      setNotice("Failed to load users.", "error");
    }
    const items = data.items || [];
    const table = document.getElementById("userTable");
    table.innerHTML = "";
    userCache.clear();
    if (!items.length) {
      table.innerHTML = "<tr><td colspan=\"7\" class=\"muted\">No users loaded yet.</td></tr>";
      return;
    }
    items.forEach((user) => {
      userCache.set(user.id, user);
      const displayName = [user.first_name, user.last_name].filter(Boolean).join(" ") || "-";
      const email = user.email || "-";
      const row = document.createElement("tr");
      const roleLabel = formatRole(user.role);
      row.innerHTML = `
        <td>${user.id}</td>
        <td>${user.username}</td>
        <td>${displayName}</td>
        <td>${email}</td>
        <td>${roleLabel}</td>
        <td>${user.created_at}</td>
        <td>
          <button class="btn soft user-edit" type="button" data-user-id="${user.id}">Edit</button>
          <button class="btn danger user-delete" type="button" data-user-id="${user.id}" ${
            user.role === "superadmin" ? "disabled" : ""
          }>Delete</button>
        </td>
      `;
      table.appendChild(row);
    });
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const username = document.getElementById("userName").value.trim();
    const password = document.getElementById("userPassword").value;
    const firstName = document.getElementById("userFirstName").value.trim();
    const lastName = document.getElementById("userLastName").value.trim();
    const email = document.getElementById("userEmail").value.trim();
    const notes = document.getElementById("userNotes").value.trim();
    if (!username || !password) {
      if (!editingUserId) {
        setNotice("Username and password are required.", "error");
        return;
      }
      if (!username) {
        setNotice("Username is required.", "error");
        return;
      }
    }
    const role = roleField ? roleField.value : "";
    const payload = { username, password };
    if (role) {
      payload.role = role;
    }
    payload.first_name = firstName;
    payload.last_name = lastName;
    payload.email = email;
    payload.notes = notes;
    if (editingUserId && !password) {
      delete payload.password;
    }
    const method = editingUserId ? "PATCH" : "POST";
    const url = editingUserId ? `/api/users/${editingUserId}` : "/api/users";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      setNotice(editingUserId ? "User updated." : "User created.", "success");
      if (firstUser) {
        window.location.reload();
        return;
      }
      clearForm(true);
      await loadUsers();
    } else {
      const data = await res.json().catch(() => ({}));
      setNotice(data.error || "Request failed.", "error");
    }
  });

  resetBtn.addEventListener("click", () => clearForm(false));
  refreshBtn.addEventListener("click", loadUsers);
  document.getElementById("userTable").addEventListener("click", async (event) => {
    const editButton = event.target.closest(".user-edit");
    if (editButton) {
      const userId = Number(editButton.dataset.userId);
      const user = userCache.get(userId);
      if (user) {
        setEditing(user);
      }
      return;
    }

    const deleteButton = event.target.closest(".user-delete");
    if (!deleteButton || deleteButton.disabled) {
      return;
    }
    const userId = Number(deleteButton.dataset.userId);
    const user = userCache.get(userId);
    if (!user || user.role === "superadmin") {
      setNotice("SuperAdmin users cannot be deleted.", "error");
      return;
    }
    const confirmed = window.confirm(`Delete user "${user.username}"?`);
    if (!confirmed) {
      return;
    }
    const res = await fetch(`/api/users/${userId}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setNotice(data.error || "Delete failed.", "error");
      return;
    }
    if (editingUserId === userId) {
      clearForm(true);
    }
    setNotice("User deleted.", "success");
    await loadUsers();
  });

  loadUsers();
});
