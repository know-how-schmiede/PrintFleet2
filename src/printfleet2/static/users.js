document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("userForm");
  const notice = document.getElementById("userNotice");
  const resetBtn = document.getElementById("userReset");
  const refreshBtn = document.getElementById("userRefresh");
  const roleField = document.getElementById("userRole");
  const firstUser = form?.dataset.firstUser === "true";

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
    document.getElementById("userName").value = "";
    document.getElementById("userPassword").value = "";
    if (roleField && roleField.tagName === "SELECT") {
      roleField.value = "user";
    }
    if (!keepNotice) {
      setNotice("", "");
    }
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
    if (!items.length) {
      table.innerHTML = "<tr><td colspan=\"4\" class=\"muted\">No users loaded yet.</td></tr>";
      return;
    }
    items.forEach((user) => {
      const row = document.createElement("tr");
      const roleLabel = formatRole(user.role);
      row.innerHTML = `
        <td>${user.id}</td>
        <td>${user.username}</td>
        <td>${roleLabel}</td>
        <td>${user.created_at}</td>
      `;
      table.appendChild(row);
    });
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const username = document.getElementById("userName").value.trim();
    const password = document.getElementById("userPassword").value;
    if (!username || !password) {
      setNotice("Username and password are required.", "error");
      return;
    }
    const role = roleField ? roleField.value : "";
    const payload = { username, password };
    if (role) {
      payload.role = role;
    }
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      setNotice("User created.", "success");
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

  loadUsers();
});
