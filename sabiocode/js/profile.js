import { getCurrentUser, isAuthenticatedSession } from "./auth.js";
import { fetchMatches, fetchUsers, removeMatchPair, updateUser } from "./api.js";

const AUTH_STORAGE_KEY = "sabiocode_user";
const SESSION_STORAGE_KEY = "sabiocode_session_active";
const CONTACT_LABELS = {
  telefone: "Telefone",
  telefoneRH: "Telefone RH",
  github: "GitHub",
  portfolio: "Portfolio",
  redeSocial: "Rede social",
  site: "Site",
  email: "E-mail"
};

function normalizeEmail(value) {
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

function getMatchTargetEmail(match) {
  return normalizeEmail(match.targetEmail || (match.unlockedContact && match.unlockedContact.email) || "");
}

function saveCurrentUser(user) {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
  // BANCO DE DADOS AQUI
}

function setFeedback(feedbackElement, message, type = "warning") {
  feedbackElement.textContent = message;
  if (type === "success") {
    feedbackElement.style.color = "#8ff0a4";
    return;
  }
  if (type === "error") {
    feedbackElement.style.color = "#ff938e";
    return;
  }
  feedbackElement.style.color = "#e3b341";
}

function updateRoleSpecificFields(form, selectedRole) {
  const roleGroups = Array.from(form.querySelectorAll(".auth-form__group"));
  roleGroups.forEach((group) => {
    group.classList.toggle("auth-form__group--visible", group.dataset.roleGroup === selectedRole);
  });
}

function updateProfileRoleButtons(roleButtons, selectedRole) {
  roleButtons.forEach((button) => {
    const isActive = button.dataset.profileRole === selectedRole;
    button.classList.toggle("profile-toggle__button--active", isActive);
    button.setAttribute("aria-checked", String(isActive));
  });
}

function movePhoto(photos, index, direction) {
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= photos.length) {
    return;
  }
  const [item] = photos.splice(index, 1);
  photos.splice(targetIndex, 0, item);
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Falha ao processar imagem."));
    reader.readAsDataURL(file);
  });
}

async function filesToDataUrls(fileList) {
  const files = Array.from(fileList || []);
  return Promise.all(files.map((file) => fileToDataUrl(file)));
}

function renderPhotoList(listElement, photos, labelPrefix) {
  listElement.innerHTML = "";
  if (!photos.length) {
    return;
  }

  const markup = photos
    .map(
      (photo, index) => `
        <article class="photo-uploader__item">
          <img class="photo-uploader__thumb" src="${photo}" alt="Preview ${labelPrefix} ${index + 1}" />
          <p class="photo-uploader__label">${labelPrefix} ${index + 1}</p>
          <div class="photo-uploader__controls">
            <button class="photo-uploader__icon-btn" type="button" data-photo-action="left" data-photo-index="${index}"><</button>
            <button class="photo-uploader__icon-btn" type="button" data-photo-action="right" data-photo-index="${index}">></button>
            <button class="photo-uploader__icon-btn" type="button" data-photo-action="remove" data-photo-index="${index}">x</button>
          </div>
        </article>
      `
    )
    .join("");

  listElement.innerHTML = markup;
}

function setupPhotoUploader({ triggerSelector, inputElement, listElement, photos, labelPrefix }) {
  const trigger = document.querySelector(triggerSelector);
  if (!trigger || !inputElement || !listElement) {
    return;
  }

  trigger.addEventListener("click", () => {
    inputElement.click();
  });

  inputElement.addEventListener("change", async () => {
    const newPhotos = await filesToDataUrls(inputElement.files);
    photos.push(...newPhotos);
    if (photos.length > 10) {
      photos.splice(10);
    }
    renderPhotoList(listElement, photos, labelPrefix);
    inputElement.value = "";
  });

  listElement.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const action = target.dataset.photoAction;
    const index = Number(target.dataset.photoIndex || -1);
    if (index < 0) {
      return;
    }

    if (action === "left") {
      movePhoto(photos, index, -1);
    }
    if (action === "right") {
      movePhoto(photos, index, 1);
    }
    if (action === "remove") {
      photos.splice(index, 1);
    }
    renderPhotoList(listElement, photos, labelPrefix);
  });
}

function formatDate(timestamp) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "Data indisponivel";
  }
  return date.toLocaleString("pt-BR");
}

function renderMatchHistory(matches, listElement) {
  listElement.innerHTML = "";

  if (!matches.length) {
    listElement.innerHTML = `
      <article class="match-item">
        <p class="match-item__text">Nenhum match encontrado ainda.</p>
      </article>
    `;
    return;
  }

  const markup = matches
    .sort((a, b) => Number(b.matchedAt || b.createdAt || 0) - Number(a.matchedAt || a.createdAt || 0))
    .map((match) => {
      const contact = match.unlockedContact || {};
      const timestamp = match.matchedAt || match.createdAt || Date.now();
      const targetEmail = getMatchTargetEmail(match);
      const contactLines = Object.entries(contact)
        .map(
          ([key, value]) =>
            `<p class="match-item__text">${escapeHtml(CONTACT_LABELS[key] || String(key))}: ${escapeHtml(
              String(value || "Nao informado")
            )}</p>`
        )
        .join("");
      return `
        <article class="match-item">
          <h4 class="match-item__title">${escapeHtml(match.profileName || "Perfil sem nome")} (${escapeHtml(
            match.profileRole || "Perfil"
          )})</h4>
          ${contactLines}
          <p class="match-item__text">Match em: ${formatDate(timestamp)}</p>
          <div class="match-item__actions">
            <button
              class="button button--danger"
              type="button"
              data-match-action="undo"
              data-match-target-email="${escapeHtml(targetEmail)}"
            >
              Desfazer match
            </button>
          </div>
        </article>
      `;
    })
    .join("");

  listElement.innerHTML = markup;
}

function populateCommonFields(form, userData) {
  const location = userData.location || {};
  form.querySelector("#profileEmail").value = userData.email || "";
  form.querySelector("#profileCountry").value = location.country || "";
  form.querySelector("#profileState").value = location.state || "";
  form.querySelector("#profileCity").value = location.city || "";
}

function populateDeveloperFields(form, userData) {
  const contact = userData.contact || {};
  const socials = userData.socials || {};
  form.querySelector("#profileName").value = userData.name || "";
  form.querySelector("#profileStack").value = userData.stack || "";
  form.querySelector("#profilePhone").value = userData.phone || contact.telefone || "";
  form.querySelector("#profileGithub").value = socials.github || contact.github || "";
  form.querySelector("#profilePortfolio").value = socials.portfolio || contact.portfolio || "";
  form.querySelector("#profileSocial").value = socials.other || contact.redeSocial || "";
  form.querySelector("#profileDescription").value = userData.description || "";
}

function populateCompanyFields(form, userData) {
  const contact = userData.contact || {};
  form.querySelector("#profileCompanyName").value = userData.companyName || "";
  form.querySelector("#profileCompanyTechStack").value = userData.companyTechStack || "";
  form.querySelector("#profileSalaryCeiling").value = userData.salaryCeiling || "";
  form.querySelector("#profileCompanyPhoneRh").value = userData.companyPhoneRh || contact.telefoneRH || "";
  form.querySelector("#profileCompanySite").value = userData.companySite || contact.site || "";
  form.querySelector("#profileBenefits").value = userData.benefits || "";
  form.querySelector("#profileWorkModel").value = userData.workModel || "";
  form.querySelector("#profileCompanyDescription").value = userData.companyDescription || "";
}

export async function initProfilePage() {
  const form = document.querySelector("#profileForm");
  const feedbackElement = document.querySelector("#profileFeedback");
  const roleLabel = document.querySelector("#profileRoleLabel");
  const roleButtons = Array.from(document.querySelectorAll("[data-profile-role]"));
  const logoutButton = document.querySelector("#logoutButton");
  const matchHistoryList = document.querySelector("#matchHistoryList");
  if (!form || !feedbackElement || !roleLabel || !logoutButton || !matchHistoryList || !roleButtons.length) {
    return;
  }

  if (!isAuthenticatedSession()) {
    window.location.href = "./login.html";
    return;
  }

  const currentUser = getCurrentUser();
  let users = [];
  try {
    users = await fetchUsers();
  } catch (error) {
    setFeedback(feedbackElement, "Falha ao carregar dados da conta.", "error");
    return;
  }
  const userIndex = users.findIndex((user) => user.email === currentUser.email);
  if (userIndex < 0) {
    window.location.href = "./login.html";
    return;
  }

  const editableUser = users[userIndex];
  let selectedRole = editableUser.role;
  const developerPhotos = Array.isArray(editableUser.photos) ? [...editableUser.photos] : [];
  const companyPhotos = Array.isArray(editableUser.companyPhotos) ? [...editableUser.companyPhotos] : [];
  roleLabel.textContent = selectedRole === "company" ? "Perfil: Empresa" : "Perfil: Desenvolvedor";
  updateProfileRoleButtons(roleButtons, selectedRole);
  updateRoleSpecificFields(form, selectedRole);

  setupPhotoUploader({
    triggerSelector: "[data-photo-trigger='profilePhotos']",
    inputElement: form.querySelector("#profilePhotos"),
    listElement: form.querySelector("#profilePhotosList"),
    photos: developerPhotos,
    labelPrefix: "Foto"
  });
  setupPhotoUploader({
    triggerSelector: "[data-photo-trigger='profileCompanyPhotos']",
    inputElement: form.querySelector("#profileCompanyPhotos"),
    listElement: form.querySelector("#profileCompanyPhotosList"),
    photos: companyPhotos,
    labelPrefix: "Ambiente"
  });

  renderPhotoList(form.querySelector("#profilePhotosList"), developerPhotos, "Foto");
  renderPhotoList(form.querySelector("#profileCompanyPhotosList"), companyPhotos, "Ambiente");

  populateCommonFields(form, editableUser);
  if (selectedRole === "company") {
    populateCompanyFields(form, editableUser);
  } else {
    populateDeveloperFields(form, editableUser);
  }

  roleButtons.forEach((button) => {
    button.addEventListener("click", () => {
      selectedRole = button.dataset.profileRole;
      updateProfileRoleButtons(roleButtons, selectedRole);
      updateRoleSpecificFields(form, selectedRole);
      roleLabel.textContent = selectedRole === "company" ? "Perfil: Empresa" : "Perfil: Desenvolvedor";
    });
  });

  async function refreshMatchHistory() {
    try {
      const matches = await fetchMatches(currentUser.email);
      renderMatchHistory(matches, matchHistoryList);
    } catch (error) {
      renderMatchHistory([], matchHistoryList);
    }
  }

  matchHistoryList.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    if (target.dataset.matchAction !== "undo") {
      return;
    }

    const targetEmail = normalizeEmail(target.dataset.matchTargetEmail || "");
    if (!targetEmail) {
      setFeedback(feedbackElement, "Nao foi possivel identificar o match para desfazer.", "error");
      return;
    }

    const confirmed = window.confirm(
      "Tem certeza que deseja desfazer este match? Essa acao remove o match das duas contas."
    );
    if (!confirmed) {
      return;
    }

    try {
      await removeMatchPair(currentUser.email, targetEmail);
    } catch (error) {
      setFeedback(feedbackElement, error.message || "Falha ao desfazer match.", "error");
      return;
    }

    await refreshMatchHistory();
    setFeedback(feedbackElement, "Match desfeito nas duas contas.", "success");
  });

  try {
    await refreshMatchHistory();
  } catch (error) {
    /* BACKEND AQUI */
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    let usersList = [];
    try {
      usersList = await fetchUsers();
    } catch (error) {
      setFeedback(feedbackElement, "Falha ao carregar contas para atualizacao.", "error");
      return;
    }
    const currentIndex = usersList.findIndex((user) => user.email === currentUser.email);
    if (currentIndex < 0) {
      setFeedback(feedbackElement, "Conta nao encontrada para atualizacao.", "error");
      return;
    }

    const email = String(formData.get("email") || "").trim().toLowerCase();
    const password = String(formData.get("password") || "").trim();
    const passwordConfirm = String(formData.get("passwordConfirm") || "").trim();

    const emailInUse = usersList.some((user, index) => index !== currentIndex && user.email === email);
    if (emailInUse) {
      setFeedback(feedbackElement, "Este e-mail ja esta em uso por outra conta.", "error");
      return;
    }

    if (password && password !== passwordConfirm) {
      setFeedback(feedbackElement, "A confirmacao de senha deve ser igual a nova senha.", "error");
      return;
    }

    const selectedPhotos = selectedRole === "company" ? companyPhotos : developerPhotos;
    if (selectedPhotos.length > 10) {
      setFeedback(feedbackElement, "Voce pode adicionar no maximo 10 fotos.", "error");
      return;
    }

    const previousUser = usersList[currentIndex];
    const location = {
      country: String(formData.get("country") || "").trim(),
      state: String(formData.get("state") || "").trim(),
      city: String(formData.get("city") || "").trim()
    };

    const baseUser = {
      email,
      role: selectedRole,
      password: previousUser.password || "",
      isPremium: Boolean(previousUser.isPremium)
    };

    const updatedUser =
      selectedRole === "company"
        ? {
            ...baseUser,
            companyName: String(formData.get("companyName") || "").trim(),
            companyTechStack: String(formData.get("companyTechStack") || "").trim(),
            salaryCeiling: String(formData.get("salaryCeiling") || "").trim(),
            companyPhoneRh: String(formData.get("companyPhoneRh") || "").trim(),
            companySite: String(formData.get("companySite") || "").trim(),
            contact: {
              telefoneRH: String(formData.get("companyPhoneRh") || "").trim(),
              site: String(formData.get("companySite") || "").trim(),
              email
            },
            benefits: String(formData.get("benefits") || "").trim(),
            workModel: String(formData.get("workModel") || "").trim(),
            companyDescription: String(formData.get("companyDescription") || "").trim(),
            companyPhotos: [...selectedPhotos],
            location
          }
        : {
            ...baseUser,
            name: String(formData.get("name") || "").trim(),
            stack: String(formData.get("stack") || "").trim(),
            phone: String(formData.get("phone") || "").trim(),
            socials: {
              github: String(formData.get("github") || "").trim(),
              portfolio: String(formData.get("portfolio") || "").trim(),
              other: String(formData.get("social") || "").trim()
            },
            contact: {
              telefone: String(formData.get("phone") || "").trim(),
              github: String(formData.get("github") || "").trim(),
              portfolio: String(formData.get("portfolio") || "").trim(),
              redeSocial: String(formData.get("social") || "").trim(),
              email
            },
            description: String(formData.get("description") || "").trim(),
            photos: [...selectedPhotos],
            location
          };

    if (password) {
      updatedUser.password = password;
    }

    /* BACKEND AQUI */
    try {
      await updateUser(currentUser.email, updatedUser);
    } catch (error) {
      setFeedback(feedbackElement, error.message || "Falha ao atualizar perfil.", "error");
      return;
    }

    saveCurrentUser({
      role: updatedUser.role,
      name: updatedUser.role === "company" ? updatedUser.companyName : updatedUser.name,
      email: updatedUser.email,
      stack: updatedUser.role === "company" ? updatedUser.companyTechStack : updatedUser.stack,
      isPremium: Boolean(updatedUser.isPremium)
    });
    currentUser.email = updatedUser.email;

    setFeedback(feedbackElement, "Perfil atualizado com sucesso.", "success");
  });

  logoutButton.addEventListener("click", () => {
    localStorage.setItem(SESSION_STORAGE_KEY, "false");
    localStorage.removeItem(AUTH_STORAGE_KEY);
    window.location.href = "./login.html";
  });

  setFeedback(feedbackElement, "");
}
