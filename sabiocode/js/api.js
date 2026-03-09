const API_BASE = "http://localhost:3000";

async function requestJson(url, options = {}) {
  const targetUrl = `${API_BASE}${url}`;
  const response = await fetch(targetUrl, {
    headers: {
      "Content-Type": "application/json"
    },
    ...options
  });

  const data = await response.json().catch(() => ({}));
  if (response.ok) {
    return data;
  }

  throw new Error(data.message || "Falha na comunicacao com o servidor.");
}

export async function fetchUsers() {
  const data = await requestJson("/api/users");
  return Array.isArray(data.users) ? data.users : [];
}

export async function loginUser(email, password) {
  const data = await requestJson("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
  return data.user;
}

export async function registerUser(userPayload) {
  const data = await requestJson("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(userPayload)
  });
  return data.user;
}

export async function updateUser(currentEmail, updatedUser) {
  const data = await requestJson("/api/users", {
    method: "PUT",
    body: JSON.stringify({ currentEmail, updatedUser })
  });
  return data.user;
}

export async function saveSwipe(swipePayload) {
  await requestJson("/api/swipes", {
    method: "POST",
    body: JSON.stringify(swipePayload)
  });
}

export async function fetchSwipes(filters = {}) {
  const params = new URLSearchParams();
  if (filters.actorEmail) {
    params.set("actorEmail", filters.actorEmail);
  }
  if (filters.targetEmail) {
    params.set("targetEmail", filters.targetEmail);
  }

  const query = params.toString();
  const data = await requestJson(`/api/swipes${query ? `?${query}` : ""}`);
  return Array.isArray(data.swipes) ? data.swipes : [];
}

export async function saveMatch(matchPayload) {
  await requestJson("/api/matches", {
    method: "POST",
    body: JSON.stringify(matchPayload)
  });
}

export async function fetchMatches(actorEmail) {
  const encodedEmail = encodeURIComponent(actorEmail || "");
  const data = await requestJson(`/api/matches?actorEmail=${encodedEmail}`);
  return Array.isArray(data.matches) ? data.matches : [];
}

export async function removeMatchPair(actorEmail, targetEmail) {
  await requestJson("/api/matches", {
    method: "DELETE",
    body: JSON.stringify({ actorEmail, targetEmail })
  });
}

export async function fetchLikesReceived(targetEmail) {
  const encodedEmail = encodeURIComponent(targetEmail || "");
  const data = await requestJson(`/api/likes-received?targetEmail=${encodedEmail}`);
  return {
    count: Number(data.count || 0),
    likers: Array.isArray(data.likers) ? data.likers : []
  };
}
