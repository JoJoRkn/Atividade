import { fetchLikesReceived } from "./api.js";
import { getCurrentUser, isAuthenticatedSession } from "./auth.js";

const PREMIUM_CHECKOUT_URL = "https://example.com/pagamento-premium";

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function initPremiumFeature() {
  const premiumButton = document.querySelector("#premiumButton");
  const likesReceivedButton = document.querySelector("#likesReceivedButton");
  const likesReceivedCount = document.querySelector("#likesReceivedCount");
  const premiumModal = document.querySelector("#premiumModal");
  const premiumBackdrop = document.querySelector("#premiumBackdrop");
  const closePremiumModalButton = document.querySelector("#closePremiumModal");
  const premiumCheckoutButton = document.querySelector("#premiumCheckoutButton");
  const premiumLikesList = document.querySelector("#premiumLikesList");
  const premiumLikesLock = document.querySelector("#premiumLikesLock");

  if (
    !premiumButton ||
    !likesReceivedButton ||
    !likesReceivedCount ||
    !premiumModal ||
    !premiumBackdrop ||
    !closePremiumModalButton ||
    !premiumCheckoutButton ||
    !premiumLikesList ||
    !premiumLikesLock
  ) {
    return;
  }

  const isAuthenticated = isAuthenticatedSession();
  const currentUser = getCurrentUser();
  const isPremium = Boolean(currentUser.isPremium);
  premiumButton.hidden = !isAuthenticated;
  likesReceivedButton.hidden = !isAuthenticated;
  let refreshTimer = null;

  function renderLikers(likers) {
    premiumLikesList.innerHTML = "";
    if (!likers.length) {
      premiumLikesList.innerHTML = '<article class="premium-likes__item">Nenhum like recebido ainda.</article>';
      return;
    }
    premiumLikesList.innerHTML = likers
      .map((liker) => {
        const roleLabel = liker.role === "company" ? "Empresa" : "Desenvolvedor";
        return `<article class="premium-likes__item">${escapeHtml(liker.name)} (${roleLabel})</article>`;
      })
      .join("");
  }

  function openPremiumModal() {
    premiumLikesLock.hidden = isPremium;
    premiumLikesList.hidden = !isPremium;
    premiumModal.classList.add("modal--open");
    refreshLikesReceived();
  }

  function closePremiumModal() {
    premiumModal.classList.remove("modal--open");
  }

  premiumButton.addEventListener("click", openPremiumModal);
  likesReceivedButton.addEventListener("click", openPremiumModal);
  closePremiumModalButton.addEventListener("click", closePremiumModal);
  premiumBackdrop.addEventListener("click", closePremiumModal);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && premiumModal.classList.contains("modal--open")) {
      closePremiumModal();
    }
  });

  premiumCheckoutButton.addEventListener("click", () => {
    /* BACKEND AQUI */
    window.location.href = PREMIUM_CHECKOUT_URL;
  });

  document.addEventListener("sabiocode:swipe-updated", () => {
    refreshLikesReceived();
  });

  function refreshLikesReceived() {
    fetchLikesReceived(currentUser.email)
      .then((result) => {
        likesReceivedCount.textContent = String(result.count);
        if (isPremium) {
          renderLikers(result.likers);
        } else {
          premiumLikesList.innerHTML = "";
        }
      })
      .catch(() => {
        likesReceivedCount.textContent = "0";
        premiumLikesList.innerHTML = "";
      });
  }

  refreshLikesReceived();

  if (isAuthenticated) {
    refreshTimer = window.setInterval(refreshLikesReceived, 5000);
  }

  window.addEventListener("focus", refreshLikesReceived);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      refreshLikesReceived();
    }
  });

  window.addEventListener("beforeunload", () => {
    if (refreshTimer) {
      window.clearInterval(refreshTimer);
    }
  });
}
