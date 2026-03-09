import { fetchUsers } from "./api.js";
import { getCurrentUser, isAuthenticatedSession } from "./auth.js";

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeRole(value) {
  return String(value || "").trim().toLowerCase();
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getAvatarFromUser(user, currentRole) {
  const developerPhoto = Array.isArray(user?.photos) ? user.photos[0] : "";
  const companyPhoto = Array.isArray(user?.companyPhotos) ? user.companyPhotos[0] : "";
  const normalizedRole = normalizeRole(currentRole);

  if (normalizedRole === "company") {
    return companyPhoto || "./assets/placeholders/profile-generic.svg";
  }

  return developerPhoto || "./assets/placeholders/profile-generic.svg";
}

export async function initSessionNav() {
  const sessionNavLink = document.querySelector("#sessionNavLink");
  if (!sessionNavLink) {
    return;
  }

  if (!isAuthenticatedSession()) {
    sessionNavLink.classList.remove("session-nav");
    sessionNavLink.textContent = "Login / Cadastro";
    sessionNavLink.setAttribute("href", "./login.html");
    return;
  }

  const currentUser = getCurrentUser();
  const profileName = currentUser.name && currentUser.name.trim() ? currentUser.name.trim() : "Meu Perfil";
  let avatar = "./assets/placeholders/profile-generic.svg";
  try {
    const users = await fetchUsers();
    const normalizedCurrentEmail = normalizeEmail(currentUser.email);
    const fullUser = users.find((user) => normalizeEmail(user.email) === normalizedCurrentEmail);
    if (fullUser) {
      avatar = getAvatarFromUser(fullUser, currentUser.role);
    }
  } catch (error) {
    avatar = "./assets/placeholders/profile-generic.svg";
  }

  sessionNavLink.classList.add("session-nav");
  sessionNavLink.innerHTML = `<img class="session-nav__avatar" src="${escapeHtml(
    avatar
  )}" alt="Foto da conta" /><span>${escapeHtml(profileName)}</span>`;
  sessionNavLink.setAttribute("href", "./profile.html");
}
