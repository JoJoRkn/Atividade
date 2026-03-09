async function bootstrap() {
  const hasAuthForm = Boolean(document.querySelector("#loginForm") && document.querySelector("#registerForm"));
  const hasSwipeBoard = Boolean(document.querySelector("#cardStack"));
  const hasPremiumButton = Boolean(document.querySelector("#premiumButton"));
  const hasSessionNavLink = Boolean(document.querySelector("#sessionNavLink"));
  const hasProfileForm = Boolean(document.querySelector("#profileForm"));

  if (hasAuthForm) {
    const { initAuthPage } = await import("./auth.js");
    initAuthPage();
  }

  if (hasSwipeBoard) {
    const { initSwipePage } = await import("./swipe.js");
    await initSwipePage();
  }

  if (hasPremiumButton) {
    const { initPremiumFeature } = await import("./premium.js");
    initPremiumFeature();
  }

  if (hasSessionNavLink) {
    const { initSessionNav } = await import("./sessionNav.js");
    await initSessionNav();
  }

  if (hasProfileForm) {
    const { initProfilePage } = await import("./profile.js");
    await initProfilePage();
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    bootstrap();
  });
} else {
  bootstrap();
}
