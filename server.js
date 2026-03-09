const http = require("http");
const fs = require("fs");
const path = require("path");

const INITIAL_PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const MAX_PORT_ATTEMPTS = 20;
const ROOT_DIR = path.resolve(__dirname);
const DEFAULT_PAGE = "/sabiocode/login.html";
const DB_DIR = path.join(ROOT_DIR, "db");
const DB_PATH = path.join(DB_DIR, "local-db.json");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon"
};

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  response.end(JSON.stringify(payload));
}

function sendText(response, statusCode, content) {
  response.writeHead(statusCode, { "Content-Type": "text/plain; charset=utf-8" });
  response.end(content);
}

function ensureDatabaseFile() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  if (!fs.existsSync(DB_PATH)) {
    const initialData = {
      users: [],
      swipes: [],
      matches: []
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(initialData, null, 2), "utf-8");
  }
}

function readDatabase() {
  ensureDatabaseFile();
  try {
    const raw = fs.readFileSync(DB_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      swipes: Array.isArray(parsed.swipes) ? parsed.swipes : [],
      matches: Array.isArray(parsed.matches) ? parsed.matches : []
    };
  } catch (error) {
    return { users: [], swipes: [], matches: [] };
  }
}

function writeDatabase(database) {
  fs.writeFileSync(DB_PATH, JSON.stringify(database, null, 2), "utf-8");
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error("JSON invalido no corpo da requisicao."));
      }
    });
    request.on("error", reject);
  });
}

function sanitizeUserForClient(user) {
  const { password, ...safeUser } = user;
  return safeUser;
}

function normalizeRole(roleValue) {
  const role = String(roleValue || "").trim().toLowerCase();
  return role === "company" ? "company" : "developer";
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function buildContactFromUser(user) {
  if (!user) {
    return {};
  }
  const role = normalizeRole(user.role);
  const contact = user.contact || {};
  if (role === "company") {
    return {
      telefoneRH: contact.telefoneRH || user.companyPhoneRh || "A combinar",
      site: contact.site || user.companySite || "A combinar",
      email: normalizeEmail(contact.email || user.email || "")
    };
  }

  const socials = user.socials || {};
  return {
    telefone: contact.telefone || user.phone || "A combinar",
    github: contact.github || socials.github || "Nao informado",
    portfolio: contact.portfolio || socials.portfolio || "Nao informado",
    redeSocial: contact.redeSocial || socials.other || "Nao informado",
    email: normalizeEmail(contact.email || user.email || "")
  };
}

function buildRoleLabelFromUser(user) {
  return normalizeRole(user?.role) === "company" ? "Empresa" : "Desenvolvedor";
}

function buildNameFromUser(user, fallbackEmail) {
  if (!user) {
    return fallbackEmail || "Perfil";
  }
  return user.name || user.companyName || fallbackEmail || "Perfil";
}

function handleApiRequest(request, response, requestUrl) {
  const { pathname } = requestUrl;

  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    });
    response.end();
    return true;
  }

  if (request.method === "GET" && pathname === "/api/users") {
    const database = readDatabase();
    sendJson(response, 200, { users: database.users.map((user) => sanitizeUserForClient(user)) });
    return true;
  }

  if (request.method === "POST" && pathname === "/api/auth/login") {
    readRequestBody(request)
      .then((body) => {
        const email = normalizeEmail(body.email);
        const password = String(body.password || "").trim();
        const database = readDatabase();
        const foundUser = database.users.find((user) => user.email === email && user.password === password);

        if (!foundUser) {
          sendJson(response, 401, { message: "Credenciais invalidas." });
          return;
        }

        sendJson(response, 200, { user: sanitizeUserForClient(foundUser) });
      })
      .catch((error) => {
        sendJson(response, 400, { message: error.message });
      });
    return true;
  }

  if (request.method === "POST" && pathname === "/api/auth/register") {
    readRequestBody(request)
      .then((body) => {
        const database = readDatabase();
        const email = normalizeEmail(body.email);

        if (!email) {
          sendJson(response, 400, { message: "E-mail e obrigatorio." });
          return;
        }

        const alreadyExists = database.users.some((user) => user.email === email);
        if (alreadyExists) {
          sendJson(response, 409, { message: "Ja existe um cadastro com este e-mail." });
          return;
        }

        const normalizedUser = {
          ...body,
          email,
          role: normalizeRole(body.role)
        };
        database.users.push(normalizedUser);
        writeDatabase(database);
        // BANCO DE DADOS AQUI
        sendJson(response, 201, { user: sanitizeUserForClient(normalizedUser) });
      })
      .catch((error) => {
        sendJson(response, 400, { message: error.message });
      });
    return true;
  }

  if (request.method === "PUT" && pathname === "/api/users") {
    readRequestBody(request)
      .then((body) => {
        const currentEmail = normalizeEmail(body.currentEmail);
        const updatedUser = body.updatedUser || null;

        if (!currentEmail || !updatedUser || !updatedUser.email) {
          sendJson(response, 400, { message: "Dados de atualizacao invalidos." });
          return;
        }

        const database = readDatabase();
        const userIndex = database.users.findIndex((user) => user.email === currentEmail);
        if (userIndex < 0) {
          sendJson(response, 404, { message: "Conta nao encontrada." });
          return;
        }

        const normalizedUpdatedEmail = normalizeEmail(updatedUser.email);
        const duplicatedEmail = database.users.some((user, index) => index !== userIndex && user.email === normalizedUpdatedEmail);
        if (duplicatedEmail) {
          sendJson(response, 409, { message: "Este e-mail ja esta em uso." });
          return;
        }

        const existingUser = database.users[userIndex];
        const preservedPassword =
          typeof updatedUser.password === "string" && updatedUser.password.trim() !== ""
            ? updatedUser.password
            : existingUser.password;

        database.users[userIndex] = {
          ...existingUser,
          ...updatedUser,
          email: normalizedUpdatedEmail,
          role: normalizeRole(updatedUser.role),
          password: preservedPassword
        };
        writeDatabase(database);
        // BANCO DE DADOS AQUI
        sendJson(response, 200, { user: sanitizeUserForClient(database.users[userIndex]) });
      })
      .catch((error) => {
        sendJson(response, 400, { message: error.message });
      });
    return true;
  }

  if (request.method === "POST" && pathname === "/api/swipes") {
    readRequestBody(request)
      .then((body) => {
        const database = readDatabase();
        const normalizedSwipe = {
          ...body,
          actorEmail: normalizeEmail(body.actorEmail),
          targetEmail: normalizeEmail(body.targetEmail)
        };
        database.swipes.push(normalizedSwipe);
        writeDatabase(database);
        // BANCO DE DADOS AQUI
        sendJson(response, 201, { ok: true });
      })
      .catch((error) => {
        sendJson(response, 400, { message: error.message });
      });
    return true;
  }

  if (request.method === "GET" && pathname === "/api/swipes") {
    const actorEmail = normalizeEmail(requestUrl.searchParams.get("actorEmail"));
    const targetEmail = normalizeEmail(requestUrl.searchParams.get("targetEmail"));
    const database = readDatabase();
    let swipes = Array.isArray(database.swipes) ? database.swipes : [];

    if (actorEmail) {
      swipes = swipes.filter((swipe) => normalizeEmail(swipe.actorEmail) === actorEmail);
    }
    if (targetEmail) {
      swipes = swipes.filter((swipe) => normalizeEmail(swipe.targetEmail) === targetEmail);
    }

    sendJson(response, 200, { swipes });
    return true;
  }

  if (request.method === "GET" && pathname === "/api/likes-received") {
    const targetEmail = normalizeEmail(requestUrl.searchParams.get("targetEmail"));
    if (!targetEmail) {
      sendJson(response, 200, { count: 0, likers: [] });
      return true;
    }

    const database = readDatabase();
    const swipes = Array.isArray(database.swipes) ? database.swipes : [];
    const users = Array.isArray(database.users) ? database.users : [];
    const isPositiveDecision = (decision) => ["like", "superlike"].includes(String(decision || "").trim().toLowerCase());

    const latestIncomingByActor = new Map();
    const latestIncomingPositiveTsByActor = new Map();
    const latestOutgoingPositiveTsByActor = new Map();

    for (const swipe of swipes) {
      const swipeActor = normalizeEmail(swipe.actorEmail);
      const swipeTarget = normalizeEmail(swipe.targetEmail);
      const swipeTimestamp = Number(swipe.timestamp || 0);

      // Swipes recebidos: actor -> targetEmail
      if (swipeTarget === targetEmail && swipeActor) {
        const previousIncoming = latestIncomingByActor.get(swipeActor);
        if (!previousIncoming || swipeTimestamp >= Number(previousIncoming.timestamp || 0)) {
          latestIncomingByActor.set(swipeActor, swipe);
        }
        if (isPositiveDecision(swipe.decision)) {
          const previousTs = Number(latestIncomingPositiveTsByActor.get(swipeActor) || 0);
          if (swipeTimestamp >= previousTs) {
            latestIncomingPositiveTsByActor.set(swipeActor, swipeTimestamp);
          }
        }
      }

      // Swipes enviados por targetEmail para o actor (reciprocidade)
      if (swipeActor === targetEmail && swipeTarget) {
        if (isPositiveDecision(swipe.decision)) {
          const previousTs = Number(latestOutgoingPositiveTsByActor.get(swipeTarget) || 0);
          if (swipeTimestamp >= previousTs) {
            latestOutgoingPositiveTsByActor.set(swipeTarget, swipeTimestamp);
          }
        }
      }
    }

    const likers = [];
    for (const [actorEmail, swipe] of latestIncomingByActor.entries()) {
      if (!isPositiveDecision(swipe.decision)) {
        continue;
      }

      // Regra de pendencia:
      // conta como like recebido apenas quando o like positivo do ator e mais recente
      // que qualquer like/superlike reciproco do target para esse mesmo ator.
      const actorLatestPositiveTs = Number(latestIncomingPositiveTsByActor.get(actorEmail) || 0);
      const targetLatestPositiveTs = Number(latestOutgoingPositiveTsByActor.get(actorEmail) || 0);
      if (!actorLatestPositiveTs || actorLatestPositiveTs <= targetLatestPositiveTs) {
        continue;
      }

      const actorUser = users.find((user) => normalizeEmail(user.email) === actorEmail);
      likers.push({
        email: actorEmail,
        role: actorUser ? normalizeRole(actorUser.role) : "developer",
        name: actorUser ? actorUser.name || actorUser.companyName || actorEmail : actorEmail
      });
    }

    sendJson(response, 200, { count: likers.length, likers });
    return true;
  }

  if (request.method === "GET" && pathname === "/api/matches") {
    const actorEmail = normalizeEmail(requestUrl.searchParams.get("actorEmail"));
    const database = readDatabase();
    const matches = actorEmail
      ? database.matches.filter((match) => normalizeEmail(match.actorEmail) === actorEmail)
      : database.matches;
    sendJson(response, 200, { matches });
    return true;
  }

  if (request.method === "POST" && pathname === "/api/matches") {
    readRequestBody(request)
      .then((body) => {
        const database = readDatabase();
        const actorEmail = normalizeEmail(body.actorEmail);
        const profileId = String(body.profileId || "").trim();
        const targetEmail = normalizeEmail(body.targetEmail);
        if (!actorEmail || !targetEmail || !profileId) {
          sendJson(response, 400, { message: "Dados de match invalidos." });
          return;
        }

        const users = Array.isArray(database.users) ? database.users : [];
        const actorUser = users.find((user) => normalizeEmail(user.email) === actorEmail);
        const targetUser = users.find((user) => normalizeEmail(user.email) === targetEmail);
        const now = Date.now();

        const actorRecord = {
          ...body,
          actorEmail,
          targetEmail,
          profileId,
          profileName: body.profileName || buildNameFromUser(targetUser, targetEmail),
          profileRole: body.profileRole || buildRoleLabelFromUser(targetUser),
          unlockedContact:
            body.unlockedContact && typeof body.unlockedContact === "object"
              ? body.unlockedContact
              : buildContactFromUser(targetUser),
          matchedAt: Number(body.matchedAt || now)
        };

        const reverseRecord = {
          actorEmail: targetEmail,
          targetEmail: actorEmail,
          profileId: `match-${actorEmail.replace(/[^a-z0-9]/gi, "_")}`,
          profileName: buildNameFromUser(actorUser, actorEmail),
          profileRole: buildRoleLabelFromUser(actorUser),
          unlockedContact: buildContactFromUser(actorUser),
          matchedAt: Number(body.matchedAt || now)
        };

        const existingActorIndex = database.matches.findIndex(
          (match) =>
            normalizeEmail(match.actorEmail) === actorEmail && normalizeEmail(match.targetEmail) === targetEmail
        );
        const existingTargetIndex = database.matches.findIndex(
          (match) =>
            normalizeEmail(match.actorEmail) === targetEmail && normalizeEmail(match.targetEmail) === actorEmail
        );

        if (existingActorIndex >= 0) {
          database.matches[existingActorIndex] = {
            ...database.matches[existingActorIndex],
            ...actorRecord,
            updatedAt: now
          };
        } else {
          database.matches.push({
            ...actorRecord,
            createdAt: now
          });
        }

        if (existingTargetIndex >= 0) {
          database.matches[existingTargetIndex] = {
            ...database.matches[existingTargetIndex],
            ...reverseRecord,
            updatedAt: now
          };
        } else {
          database.matches.push({
            ...reverseRecord,
            createdAt: now
          });
        }

        writeDatabase(database);
        // BANCO DE DADOS AQUI
        sendJson(response, 201, { ok: true });
      })
      .catch((error) => {
        sendJson(response, 400, { message: error.message });
      });
    return true;
  }

  if (request.method === "DELETE" && pathname === "/api/matches") {
    readRequestBody(request)
      .then((body) => {
        const actorEmail = normalizeEmail(body.actorEmail);
        const targetEmail = normalizeEmail(body.targetEmail);
        if (!actorEmail || !targetEmail) {
          sendJson(response, 400, { message: "Dados de desfazer match invalidos." });
          return;
        }

        const database = readDatabase();
        const previousCount = Array.isArray(database.matches) ? database.matches.length : 0;

        database.matches = (Array.isArray(database.matches) ? database.matches : []).filter((match) => {
          const matchActorEmail = normalizeEmail(match.actorEmail);
          const matchTargetEmail = normalizeEmail(match.targetEmail || (match.unlockedContact && match.unlockedContact.email));

          const isSamePair =
            (matchActorEmail === actorEmail && matchTargetEmail === targetEmail) ||
            (matchActorEmail === targetEmail && matchTargetEmail === actorEmail);

          return !isSamePair;
        });

        writeDatabase(database);
        // BANCO DE DADOS AQUI
        sendJson(response, 200, {
          ok: true,
          removed: previousCount - database.matches.length
        });
      })
      .catch((error) => {
        sendJson(response, 400, { message: error.message });
      });
    return true;
  }

  return false;
}

function resolveFilePath(urlPathname) {
  const normalizedPath = urlPathname === "/" ? DEFAULT_PAGE : urlPathname;
  const decodedPath = decodeURIComponent(normalizedPath);
  const filePath = path.resolve(ROOT_DIR, `.${decodedPath}`);
  if (!filePath.startsWith(ROOT_DIR)) {
    return null;
  }
  return filePath;
}

const server = http.createServer((request, response) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);

  if (requestUrl.pathname.startsWith("/api/")) {
    const handled = handleApiRequest(request, response, requestUrl);
    if (!handled) {
      sendJson(response, 404, { message: "Rota de API nao encontrada." });
    }
    return;
  }

  const filePath = resolveFilePath(requestUrl.pathname);
  if (!filePath) {
    sendText(response, 403, "Acesso negado.");
    return;
  }

  fs.stat(filePath, (statError, stats) => {
    if (statError) {
      sendText(response, 404, "Arquivo nao encontrado.");
      return;
    }

    const targetPath = stats.isDirectory() ? path.join(filePath, "index.html") : filePath;
    const extension = path.extname(targetPath).toLowerCase();
    const contentType = MIME_TYPES[extension] || "application/octet-stream";

    fs.readFile(targetPath, (readError, fileContent) => {
      if (readError) {
        sendText(response, 500, "Erro interno ao carregar arquivo.");
        return;
      }

      response.writeHead(200, { "Content-Type": contentType });
      response.end(fileContent);
    });
  });
});

let currentPort = INITIAL_PORT;
let portAttempts = 0;

server.on("listening", () => {
  const address = server.address();
  const activePort = typeof address === "object" && address ? address.port : currentPort;
  console.log(`Sabiacode rodando em http://localhost:${activePort}`);
  console.log(`Pagina inicial: http://localhost:${activePort}${DEFAULT_PAGE}`);
  console.log(`DB local: ${DB_PATH}`);
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE" && portAttempts < MAX_PORT_ATTEMPTS) {
    portAttempts += 1;
    currentPort += 1;
    console.warn(`Porta em uso. Tentando porta ${currentPort}...`);
    server.listen(currentPort);
    return;
  }

  console.error("Falha ao iniciar o servidor:", error.message);
  process.exit(1);
});

ensureDatabaseFile();
server.listen(currentPort);
