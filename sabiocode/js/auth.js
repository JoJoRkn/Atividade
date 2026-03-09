import { loginUser, registerUser } from "./api.js";

const AUTH_STORAGE_KEY = "sabiocode_user";
const SESSION_STORAGE_KEY = "sabiocode_session_active";

function getDefaultUser() {
  return {
    role: "developer",
    name: "",
    email: "",
    stack: ""
  };
}

export function getCurrentUser() {
  try {
    const storedValue = localStorage.getItem(AUTH_STORAGE_KEY);
    return storedValue ? JSON.parse(storedValue) : getDefaultUser();
  } catch (error) {
    return getDefaultUser();
  }
}

export function isAuthenticatedSession() {
  const currentUser = getCurrentUser();
  const hasUserEmail = Boolean(currentUser && typeof currentUser.email === "string" && currentUser.email.trim() !== "");
  const hasActiveSession = localStorage.getItem(SESSION_STORAGE_KEY) === "true";
  return hasUserEmail && hasActiveSession;
}

function setSessionActive(isActive) {
  localStorage.setItem(SESSION_STORAGE_KEY, isActive ? "true" : "false");
}

function saveCurrentUser(user) {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
  // BANCO DE DADOS AQUI
}

function updateRoleButtons(buttons, selectedRole) {
  buttons.forEach((button) => {
    const isActive = button.dataset.role === selectedRole;
    button.classList.toggle("profile-toggle__button--active", isActive);
    button.setAttribute("aria-checked", String(isActive));
  });
}

function updateModeButtons(buttons, selectedMode) {
  buttons.forEach((button) => {
    const isActive = button.dataset.authMode === selectedMode;
    button.classList.toggle("auth-mode-toggle__button--active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });
}

function updateSectionVisibility(loginForm, registerForm, selectedMode) {
  const isLoginMode = selectedMode === "login";
  loginForm.classList.toggle("auth-form--visible", isLoginMode);
  registerForm.classList.toggle("auth-form--visible", !isLoginMode);
}

function updateRoleSpecificFields(registerForm, selectedRole) {
  const roleGroups = Array.from(registerForm.querySelectorAll(".auth-form__group"));
  roleGroups.forEach((group) => {
    const isVisible = group.dataset.roleGroup === selectedRole;
    group.classList.toggle("auth-form__group--visible", isVisible);
  });
}

function updateRequiredFields(loginForm, registerForm, selectedMode) {
  const loginInputs = Array.from(loginForm.querySelectorAll("input"));
  const registerInputs = Array.from(registerForm.querySelectorAll("input, textarea, select"));

  loginInputs.forEach((input) => {
    input.required = selectedMode === "login" && (input.name === "email" || input.name === "password");
  });

  const baseRequiredFields = ["email", "password", "passwordConfirm", "country", "state", "city"];
  const roleRequiredFields = {
    developer: ["name", "stack", "phone", "github", "portfolio", "social", "description"],
    company: [
      "companyName",
      "companyTechStack",
      "salaryCeiling",
      "companyPhoneRh",
      "companySite",
      "benefits",
      "workModel",
      "companyDescription"
    ]
  };

  const activeRole = registerForm.dataset.activeRole || "developer";
  const activeRequiredFields = [...baseRequiredFields, ...(roleRequiredFields[activeRole] || [])];

  registerInputs.forEach((input) => {
    input.required = selectedMode === "register" && activeRequiredFields.includes(input.name);
  });
}

function setFeedback(feedbackElement, message, type = "warning") {
  if (!feedbackElement) {
    return;
  }

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

function getSelectedRoleFromUi(roleButtons, fallbackRole) {
  const activeButton = roleButtons.find((button) => button.getAttribute("aria-checked") === "true");
  return activeButton?.dataset.role || fallbackRole;
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

function movePhoto(photos, index, direction) {
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= photos.length) {
    return;
  }
  const [item] = photos.splice(index, 1);
  photos.splice(targetIndex, 0, item);
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

export function initAuthPage() {
  const loginForm = document.querySelector("#loginForm");
  const registerForm = document.querySelector("#registerForm");
  if (!loginForm || !registerForm) {
    return;
  }

  const roleButtons = Array.from(document.querySelectorAll(".profile-toggle__button"));
  const modeButtons = Array.from(document.querySelectorAll(".auth-mode-toggle__button"));
  const feedbackElement = document.querySelector("#authFeedback");
  const currentUser = getCurrentUser();

  let selectedRole = currentUser.role || "developer";
  let selectedMode = "login";
  const developerPhotos = [];
  const companyPhotos = [];
  registerForm.dataset.activeRole = selectedRole;

  updateRoleButtons(roleButtons, selectedRole);
  updateModeButtons(modeButtons, selectedMode);
  updateSectionVisibility(loginForm, registerForm, selectedMode);
  updateRoleSpecificFields(registerForm, selectedRole);
  updateRequiredFields(loginForm, registerForm, selectedMode);

  setupPhotoUploader({
    triggerSelector: "[data-photo-trigger='registerPhotos']",
    inputElement: registerForm.querySelector("#registerPhotos"),
    listElement: registerForm.querySelector("#registerPhotosList"),
    photos: developerPhotos,
    labelPrefix: "Foto"
  });
  setupPhotoUploader({
    triggerSelector: "[data-photo-trigger='registerCompanyPhotos']",
    inputElement: registerForm.querySelector("#registerCompanyPhotos"),
    listElement: registerForm.querySelector("#registerCompanyPhotosList"),
    photos: companyPhotos,
    labelPrefix: "Ambiente"
  });

  roleButtons.forEach((button) => {
    button.addEventListener("click", () => {
      selectedRole = button.dataset.role;
      registerForm.dataset.activeRole = selectedRole;
      updateRoleButtons(roleButtons, selectedRole);
      updateRoleSpecificFields(registerForm, selectedRole);
      updateRequiredFields(loginForm, registerForm, selectedMode);
      const selectedRoleLabel = selectedRole === "company" ? "Empresa" : "Desenvolvedor";
      setFeedback(feedbackElement, `Perfil selecionado: ${selectedRoleLabel}`);
    });
  });

  modeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      selectedMode = button.dataset.authMode;
      updateModeButtons(modeButtons, selectedMode);
      updateSectionVisibility(loginForm, registerForm, selectedMode);
      updateRequiredFields(loginForm, registerForm, selectedMode);
      setFeedback(feedbackElement, "");
    });
  });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(loginForm);
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const password = String(formData.get("password") || "").trim();

    /* BACKEND AQUI */
    let matchedUser = null;
    try {
      matchedUser = await loginUser(email, password);
    } catch (error) {
      setFeedback(feedbackElement, "Credenciais invalidas. Verifique e tente novamente.", "error");
      return;
    }

    const authenticatedUser = {
      role: matchedUser.role,
      name: matchedUser.name || matchedUser.companyName || "",
      email: matchedUser.email,
      stack: matchedUser.stack || matchedUser.companyTechStack || "",
      isPremium: Boolean(matchedUser.isPremium)
    };

    setSessionActive(true);
    saveCurrentUser(authenticatedUser);
    window.location.href = "./index.html";
  });

  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    selectedRole = getSelectedRoleFromUi(roleButtons, selectedRole);
    registerForm.dataset.activeRole = selectedRole;
    updateRoleSpecificFields(registerForm, selectedRole);
    updateRequiredFields(loginForm, registerForm, selectedMode);

    const formData = new FormData(registerForm);
    const selectedPhotos = selectedRole === "company" ? companyPhotos : developerPhotos;
    const password = String(formData.get("password") || "").trim();
    const passwordConfirm = String(formData.get("passwordConfirm") || "").trim();

    if (password !== passwordConfirm) {
      setFeedback(feedbackElement, "A confirmacao de senha deve ser igual a senha.", "error");
      return;
    }

    if (selectedPhotos.length > 10) {
      setFeedback(feedbackElement, "Voce pode adicionar no maximo 10 fotos.", "error");
      return;
    }

    const email = String(formData.get("email") || "").trim().toLowerCase();

    const location = {
      country: String(formData.get("country") || "").trim(),
      state: String(formData.get("state") || "").trim(),
      city: String(formData.get("city") || "").trim()
    };

    const newUser =
      selectedRole === "company"
        ? {
            role: selectedRole,
            companyName: String(formData.get("companyName") || "").trim(),
            email,
            password,
            isPremium: false,
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
            role: selectedRole,
            name: String(formData.get("name") || "").trim(),
            email,
            password,
            isPremium: false,
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
            photos: [...selectedPhotos],
            description: String(formData.get("description") || "").trim(),
            location
          };

    /* BACKEND AQUI */
    try {
      await registerUser(newUser);
    } catch (error) {
      setFeedback(feedbackElement, error.message || "Falha ao cadastrar conta.", "error");
      return;
    }
    setSessionActive(false);
    setFeedback(feedbackElement, "Cadastro realizado. Agora faca login para liberar o swipe.", "success");
    registerForm.reset();
    developerPhotos.length = 0;
    companyPhotos.length = 0;
    const devList = registerForm.querySelector("#registerPhotosList");
    const companyList = registerForm.querySelector("#registerCompanyPhotosList");
    if (devList) {
      devList.innerHTML = "";
    }
    if (companyList) {
      companyList.innerHTML = "";
    }
    selectedMode = "login";
    updateModeButtons(modeButtons, selectedMode);
    updateSectionVisibility(loginForm, registerForm, selectedMode);
    updateRequiredFields(loginForm, registerForm, selectedMode);
  });

  setFeedback(feedbackElement, "");
}
