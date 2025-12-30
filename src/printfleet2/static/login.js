document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("loginForm");
  const notice = document.getElementById("loginNotice");

  if (!form || !notice) {
    return;
  }

  function setNotice(message, type) {
    notice.textContent = message;
    notice.className = "notice " + (type || "");
    if (!message) {
      notice.className = "notice";
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const username = document.getElementById("loginUsername").value.trim();
    const password = document.getElementById("loginPassword").value;
    if (!username || !password) {
      setNotice("Username and password are required.", "error");
      return;
    }
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
      credentials: "same-origin",
    });
    if (res.ok) {
      setNotice("Login successful.", "success");
      window.location.href = "/";
    } else {
      const data = await res.json().catch(() => ({}));
      setNotice(data.error || "Login failed.", "error");
    }
  });
});
