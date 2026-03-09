import { companyAurora } from "./placeholders/profiles/company-aurora.js";
import { companyByteforge } from "./placeholders/profiles/company-byteforge.js";
import { companyNebula } from "./placeholders/profiles/company-nebula.js";
import { fetchUsers } from "./api.js";
import { devCamila } from "./placeholders/profiles/dev-camila.js";
import { devLivia } from "./placeholders/profiles/dev-livia.js";
import { devMateus } from "./placeholders/profiles/dev-mateus.js";

/*
 * Perfis placeholders mantidos em arquivos separados para facilitar exclusao
 * quando o backend real estiver funcional.
 */
const companyProfiles = [companyNebula, companyByteforge, companyAurora];
const developerProfiles = [devLivia, devMateus, devCamila];

function splitTags(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeRole(roleValue) {
  return String(roleValue || "").trim().toLowerCase();
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function mapRegisteredDeveloperToProfile(user, index) {
  const contact = user.contact || {};
  const socials = user.socials || {};
  const developerContact = {
    telefone: contact.telefone || user.phone || "A combinar",
    github: contact.github || socials.github || "Nao informado",
    portfolio: contact.portfolio || socials.portfolio || "Nao informado",
    redeSocial: contact.redeSocial || socials.other || "Nao informado",
    email: contact.email || user.email || "nao informado"
  };

  return {
    id: `reg-dev-${String(user.email || index).replace(/[^a-zA-Z0-9]/g, "_")}`,
    sourceEmail: normalizeEmail(user.email),
    name: user.name || "Dev sem nome",
    role: "Desenvolvedor",
    bio: user.description || "Perfil de desenvolvedor cadastrado no Sabiacode.",
    tags: splitTags(user.stack),
    gallery: Array.isArray(user.photos) && user.photos.length ? user.photos : ["./assets/placeholders/profile-generic.svg"],
    image: "./assets/placeholders/profile-generic.svg",
    contact: developerContact,
    interested: true
  };
}

function mapRegisteredCompanyToProfile(user, index) {
  const salaryLabel = String(user.salaryCeiling || "").trim() || "A combinar";
  const contact = user.contact || {};
  const companyContact = {
    telefoneRH: contact.telefoneRH || user.companyPhoneRh || "A combinar",
    site: contact.site || user.companySite || "A combinar",
    email: contact.email || user.email || "nao informado"
  };

  return {
    id: `reg-cmp-${String(user.email || index).replace(/[^a-zA-Z0-9]/g, "_")}`,
    sourceEmail: normalizeEmail(user.email),
    name: user.companyName || "Empresa sem nome",
    role: "Empresa",
    bio: user.companyDescription || `Vaga com teto salarial ${salaryLabel}.`,
    tags: [...splitTags(user.companyTechStack), user.workModel || ""].filter(Boolean),
    gallery:
      Array.isArray(user.companyPhotos) && user.companyPhotos.length
        ? user.companyPhotos
        : ["./assets/placeholders/profile-generic.svg"],
    image: "./assets/placeholders/profile-generic.svg",
    contact: companyContact,
    interested: true
  };
}

export async function getProfilesForRole(role, currentUser) {
  if (!currentUser || !currentUser.email) {
    return [];
  }

  let users = [];
  try {
    users = await fetchUsers();
  } catch (error) {
    users = [];
  }

  const currentEmail = normalizeEmail(currentUser.email);
  const registeredUsers = users.filter((user) => normalizeEmail(user.email) !== currentEmail);
  const registeredDeveloperProfiles = registeredUsers
    .filter((user) => normalizeRole(user.role) === "developer")
    .map((user, index) => mapRegisteredDeveloperToProfile(user, index));
  const registeredCompanyProfiles = registeredUsers
    .filter((user) => normalizeRole(user.role) === "company")
    .map((user, index) => mapRegisteredCompanyToProfile(user, index));

  return role === "company"
    ? [...developerProfiles, ...registeredDeveloperProfiles]
    : [...companyProfiles, ...registeredCompanyProfiles];
}
