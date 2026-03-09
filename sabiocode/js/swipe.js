import { getProfilesForRole } from "./mockData.js";
import { fetchSwipes, saveMatch, saveSwipe } from "./api.js";
import { getCurrentUser, isAuthenticatedSession } from "./auth.js";

const SWIPE_DECISION = {
  like: "like",
  dislike: "dislike",
  superlike: "superlike"
};

const CONTACT_LABELS = {
  telefone: "Telefone",
  telefoneRH: "Telefone RH",
  github: "GitHub",
  portfolio: "Portfolio",
  redeSocial: "Rede social",
  site: "Site",
  email: "E-mail"
};
const SWIPE_PROGRESS_KEY_PREFIX = "sabiocode_swipe_progress";

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function getProgressStorageKey(user) {
  const role = String(user?.role || "").trim().toLowerCase() || "developer";
  const email = normalizeEmail(user?.email || "");
  return `${SWIPE_PROGRESS_KEY_PREFIX}:${email}:${role}`;
}

function loadSeenProfileIds(user) {
  const key = getProgressStorageKey(user);
  try {
    const storedValue = localStorage.getItem(key);
    const parsed = storedValue ? JSON.parse(storedValue) : [];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch (error) {
    return new Set();
  }
}

function saveSeenProfileIds(user, seenIds) {
  const key = getProgressStorageKey(user);
  localStorage.setItem(key, JSON.stringify(Array.from(seenIds)));
}

function clearSeenProfileIds(user) {
  const key = getProgressStorageKey(user);
  localStorage.removeItem(key);
}

function createProfileCard(profile) {
  const card = document.createElement("article");
  card.className = "card card--visible";
  card.dataset.profileId = profile.id;
  const gallery =
    Array.isArray(profile.gallery) && profile.gallery.length
      ? profile.gallery
      : [profile.image || "./assets/placeholders/profile-generic.svg"];
  const imageSrc = gallery[0];
  const hasMultiplePhotos = gallery.length > 1;

  card.innerHTML = `
    <figure class="card__media">
      ${
        hasMultiplePhotos
          ? '<button class="card__carousel-btn card__carousel-btn--prev" type="button" data-carousel-action="prev"><</button>'
          : ""
      }
      <img class="card__image" src="${imageSrc}" alt="Foto do perfil de ${profile.name}" loading="lazy" />
      ${
        hasMultiplePhotos
          ? '<button class="card__carousel-btn card__carousel-btn--next" type="button" data-carousel-action="next">></button>'
          : ""
      }
      ${hasMultiplePhotos ? `<span class="card__carousel-count">1/${gallery.length}</span>` : ""}
    </figure>
    <header class="card__header">
      <h2 class="card__name">${profile.name}</h2>
      <span class="card__role">${profile.role}</span>
    </header>
    <p class="card__bio">${profile.bio}</p>
    <div class="card__list">
      ${profile.tags.map((tag) => `<span class="card__tag">${tag}</span>`).join("")}
    </div>
  `;

  if (hasMultiplePhotos) {
    let currentPhotoIndex = 0;
    const imageElement = card.querySelector(".card__image");
    const countElement = card.querySelector(".card__carousel-count");

    card.querySelectorAll("[data-carousel-action]").forEach((button) => {
      button.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const action = button.dataset.carouselAction;
        if (action === "prev") {
          currentPhotoIndex = (currentPhotoIndex - 1 + gallery.length) % gallery.length;
        } else {
          currentPhotoIndex = (currentPhotoIndex + 1) % gallery.length;
        }
        if (imageElement) {
          imageElement.src = gallery[currentPhotoIndex];
        }
        if (countElement) {
          countElement.textContent = `${currentPhotoIndex + 1}/${gallery.length}`;
        }
      });
    });
  }

  return card;
}

function isPositiveDecision(decision) {
  return decision === SWIPE_DECISION.like || decision === SWIPE_DECISION.superlike;
}

async function isMutualMatch(profile, decision, actorEmail) {
  if (!isPositiveDecision(decision)) {
    return false;
  }

  if (!profile.sourceEmail) {
    return false;
  }

  const normalizedActorEmail = normalizeEmail(actorEmail);
  const normalizedTargetEmail = normalizeEmail(profile.sourceEmail);

  const reciprocalSwipes = await fetchSwipes({
    actorEmail: normalizedTargetEmail,
    targetEmail: normalizedActorEmail
  });

  if (!reciprocalSwipes.length) {
    return false;
  }

  const latestReciprocalSwipe = reciprocalSwipes.reduce((latestSwipe, currentSwipe) => {
    const latestTimestamp = Number(latestSwipe?.timestamp || 0);
    const currentTimestamp = Number(currentSwipe?.timestamp || 0);
    return currentTimestamp >= latestTimestamp ? currentSwipe : latestSwipe;
  }, null);

  return isPositiveDecision(String(latestReciprocalSwipe?.decision || ""));
}

function openMatchModal(profile) {
  const modal = document.querySelector("#matchModal");
  const message = document.querySelector("#matchMessage");
  const contact = document.querySelector("#matchContact");
  if (!modal || !message || !contact) {
    return;
  }

  const contactEntries = Object.entries(profile.contact || {});
  const contactMarkup = contactEntries
    .map(([key, value]) => `<p>${CONTACT_LABELS[key] || key}: ${String(value || "Nao informado")}</p>`)
    .join("");

  message.textContent = `Voce e ${profile.name} curtiram um ao outro. Contatos liberados:`;
  contact.innerHTML = contactMarkup || "<p>Nenhum contato disponivel.</p>";
  modal.classList.add("modal--open");
}

function closeMatchModal() {
  const modal = document.querySelector("#matchModal");
  modal?.classList.remove("modal--open");
}

function applyDecisionVisual(card, decision) {
  card.classList.remove("card--like", "card--dislike", "card--superlike");
  card.classList.add(`card--${decision}`);
}

function notifySwipeUpdated() {
  document.dispatchEvent(new CustomEvent("sabiocode:swipe-updated"));
}

async function persistSwipeDecision(profile, decision, actorEmail) {
  const normalizedTargetEmail = normalizeEmail(profile.sourceEmail || "");
  if (!normalizedTargetEmail) {
    return;
  }

  await saveSwipe({
    actorEmail: normalizeEmail(actorEmail),
    targetEmail: normalizedTargetEmail,
    profileId: profile.id,
    decision,
    timestamp: Date.now()
  });
  // BANCO DE DADOS AQUI
}

async function persistMatch(profile, actorEmail) {
  await saveMatch({
    actorEmail: normalizeEmail(actorEmail),
    targetEmail: normalizeEmail(profile.sourceEmail || ""),
    profileId: profile.id,
    profileName: profile.name,
    profileRole: profile.role,
    unlockedContact: profile.contact,
    matchedAt: Date.now()
  });
  // BANCO DE DADOS AQUI
}

function animateCardOut(card, decision) {
  const directionX = decision === SWIPE_DECISION.dislike ? -1 : 1;
  const directionY = decision === SWIPE_DECISION.superlike ? -1 : 0;
  card.style.transform = `translate(${directionX * 120}%, ${directionY * -120}%) rotate(${directionX * 20}deg)`;
  card.style.opacity = "0";
}

function setupModalCloseActions() {
  const closeButton = document.querySelector("#closeMatchModal");
  const closeTargets = Array.from(document.querySelectorAll("[data-close-modal='true']"));
  closeButton?.addEventListener("click", closeMatchModal);
  closeTargets.forEach((target) => target.addEventListener("click", closeMatchModal));
}

export async function initSwipePage() {
  const stack = document.querySelector("#cardStack");
  const emptyCard = document.querySelector("#emptyCard");
  if (!stack || !emptyCard) {
    return;
  }

  if (!isAuthenticatedSession()) {
    window.location.href = "./login.html";
    return;
  }

  const currentUser = getCurrentUser();
  const roleLabel = document.querySelector("#roleLabel");
  if (roleLabel) {
    roleLabel.textContent = `Perfil: ${currentUser.role === "company" ? "Empresa" : "Desenvolvedor"}`;
  }

  const profiles = (await getProfilesForRole(currentUser.role, currentUser)).slice();
  const seenProfileIds = loadSeenProfileIds(currentUser);
  let visibleProfiles = profiles.filter((profile) => !seenProfileIds.has(profile.id));
  let currentIndex = 0;

  const dislikeButton = document.querySelector("#dislikeButton");
  const undoSwipeButton = document.querySelector("#undoSwipeButton");
  const likeButton = document.querySelector("#likeButton");
  const superlikeButton = document.querySelector("#superlikeButton");
  const resetSwipeFeedButton = document.querySelector("#resetSwipeFeedButton");
  const decisionHistory = [];

  setupModalCloseActions();

  function hasNextCard() {
    return currentIndex < visibleProfiles.length;
  }

  function getCurrentCard() {
    return stack.querySelector(".card--active");
  }

  function mountCard() {
    const activeCard = getCurrentCard();
    if (activeCard) {
      activeCard.classList.remove("card--active");
    }

    if (!hasNextCard()) {
      emptyCard.classList.add("card--visible");
      if (resetSwipeFeedButton) {
        resetSwipeFeedButton.hidden = false;
      }
      return;
    }

    if (resetSwipeFeedButton) {
      resetSwipeFeedButton.hidden = true;
    }

    const profile = visibleProfiles[currentIndex];
    const card = createProfileCard(profile);
    card.classList.add("card--active");
    stack.appendChild(card);
    enableDrag(card);
  }

  async function handleDecision(decision) {
    const card = getCurrentCard();
    if (!card || !hasNextCard()) {
      return;
    }

    const profile = visibleProfiles[currentIndex];
    decisionHistory.push({ index: currentIndex, profileId: profile.id });
    applyDecisionVisual(card, decision);
    await persistSwipeDecision(profile, decision, currentUser.email).catch(() => {
      /* BACKEND AQUI */
    });
    animateCardOut(card, decision);
    seenProfileIds.add(profile.id);
    saveSeenProfileIds(currentUser, seenProfileIds);

    try {
      if (await isMutualMatch(profile, decision, currentUser.email)) {
        openMatchModal(profile);
        persistMatch(profile, currentUser.email).catch(() => {
          /* BACKEND AQUI */
        });
        /* BACKEND AQUI */
      }
    } catch (error) {
      /* BACKEND AQUI */
    }

    notifySwipeUpdated();

    card.addEventListener(
      "transitionend",
      () => {
        card.remove();
      },
      { once: true }
    );

    currentIndex += 1;
    setTimeout(mountCard, 100);
  }

  function undoLastSwipe() {
    if (!decisionHistory.length) {
      return;
    }

    const activeCard = getCurrentCard();
    if (activeCard) {
      activeCard.remove();
    }

    const previousState = decisionHistory.pop();
    if (!previousState || typeof previousState.index !== "number") {
      return;
    }

    if (previousState.profileId) {
      seenProfileIds.delete(previousState.profileId);
      saveSeenProfileIds(currentUser, seenProfileIds);
    }

    currentIndex = previousState.index;
    emptyCard.classList.remove("card--visible");
    mountCard();
  }

  function resetSwipeFeed() {
    clearSeenProfileIds(currentUser);
    seenProfileIds.clear();
    visibleProfiles = profiles.slice();
    currentIndex = 0;
    decisionHistory.length = 0;
    const activeCard = getCurrentCard();
    if (activeCard) {
      activeCard.remove();
    }
    emptyCard.classList.remove("card--visible");
    mountCard();
  }

  function enableDrag(card) {
    let startX = 0;
    let startY = 0;
    let offsetX = 0;
    let offsetY = 0;
    let isDragging = false;

    function pointerDown(event) {
      const target = event.target;
      if (target instanceof HTMLElement && target.closest("[data-carousel-action]")) {
        return;
      }
      isDragging = true;
      card.classList.add("card--dragging");
      startX = event.clientX;
      startY = event.clientY;
      card.setPointerCapture(event.pointerId);
    }

    function pointerMove(event) {
      if (!isDragging) {
        return;
      }

      offsetX = event.clientX - startX;
      offsetY = event.clientY - startY;

      /*
       * O angulo do card segue deslocamento horizontal para deixar o movimento natural.
       * Quanto maior o deslocamento em X, maior a rotacao aplicada.
       */
      const rotate = offsetX * 0.08;
      card.style.transform = `translate(${offsetX}px, ${offsetY}px) rotate(${rotate}deg)`;
    }

    function pointerUp() {
      if (!isDragging) {
        return;
      }
      isDragging = false;
      card.classList.remove("card--dragging");

      const horizontalThreshold = 120;
      const verticalThreshold = -130;

      if (offsetY < verticalThreshold) {
        handleDecision(SWIPE_DECISION.superlike);
        return;
      }

      if (offsetX > horizontalThreshold) {
        handleDecision(SWIPE_DECISION.like);
        return;
      }

      if (offsetX < -horizontalThreshold) {
        handleDecision(SWIPE_DECISION.dislike);
        return;
      }

      card.style.transform = "";
      offsetX = 0;
      offsetY = 0;
    }

    card.addEventListener("pointerdown", pointerDown);
    card.addEventListener("pointermove", pointerMove);
    card.addEventListener("pointerup", pointerUp);
    card.addEventListener("pointercancel", pointerUp);
  }

  dislikeButton?.addEventListener("click", () => handleDecision(SWIPE_DECISION.dislike));
  undoSwipeButton?.addEventListener("click", undoLastSwipe);
  likeButton?.addEventListener("click", () => handleDecision(SWIPE_DECISION.like));
  superlikeButton?.addEventListener("click", () => handleDecision(SWIPE_DECISION.superlike));
  resetSwipeFeedButton?.addEventListener("click", resetSwipeFeed);

  document.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") {
      handleDecision(SWIPE_DECISION.dislike);
    }
    if (event.key === "ArrowRight") {
      handleDecision(SWIPE_DECISION.like);
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      handleDecision(SWIPE_DECISION.superlike);
    }
  });

  mountCard();
}
