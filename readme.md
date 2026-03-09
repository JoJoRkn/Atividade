# SabiáCode MVP - Guia Completo de Manutenção

Este documento é o manual principal para qualquer pessoa que vai evoluir o projeto. O objetivo é que consigam entender rapidamente onde está cada funcionalidade, como os dados fluem e como alterar o sistema sem quebrar o comportamento atual.

---

## 1) Visão geral

O SabiáCode é uma plataforma de recrutamento com mecânica de swipe (estilo Tinder), com dois papéis:

- `developer`: busca vagas/empresas.
- `company`: busca desenvolvedores.

Principais features em produção no MVP:

- cadastro/login com papéis;
- sessão local;
- swipe com `dislike`, `like`, `superlike` e botão de voltar card;
- detecção de match recíproco;
- histórico de matches no perfil;
- desfazer match sincronizado nas duas contas;
- Premium com contador de likes pendentes e lista de quem curtiu (para premium);
- persistência em banco local JSON (`db/local-db.json`) via API Node.

---

## 2) Stack e execução local

### Stack

- Frontend: HTML5 + CSS3 + JavaScript ES Modules (sem framework).
- Backend: Node.js (`http`, `fs`, `path`) sem framework.
- Banco local: arquivo JSON.

### Requisitos

- Node.js instalado.

### Rodar projeto

```bash
npm start
```

Pontos importantes:

- API e frontend usam `http://localhost:3000`.
- Script de start está em `package.json`.
- Página inicial configurada no servidor: `/sabiocode/login.html`.

---

## 3) Estrutura de pastas e responsabilidade de cada arquivo

```text
/ (raiz)
  package.json
  server.js
  /db
    local-db.json
  /sabiocode
    index.html
    login.html
    profile.html
    /css
      variables.css
      reset.css
      layout.css
      components.css
    /js
      main.js
      api.js
      auth.js
      mockData.js
      swipe.js
      premium.js
      sessionNav.js
      profile.js
      /placeholders/profiles
        dev-*.js
        company-*.js
```

### Backend

- `server.js`
  - serve arquivos estáticos;
  - expõe API (`/api/...`);
  - lê/escreve `db/local-db.json`;
  - normaliza `email` e `role`;
  - aplica regras de likes pendentes e sincronização de matches.

- `db/local-db.json`
  - base local com `users`, `swipes`, `matches`.

### Frontend - páginas

- `sabiocode/login.html`: login/cadastro.
- `sabiocode/index.html`: board de swipe + modal de match + modal premium.
- `sabiocode/profile.html`: edição de conta + histórico de matches.

### Frontend - CSS

- `variables.css`: tema, cores, tipografia, espaçamentos, etc.
- `reset.css`: reset básico.
- `layout.css`: posicionamento macro (topbar, board, controles).
- `components.css`: botões, cards, modais, formulários, uploader, etc.

### Frontend - JS

- `main.js`: bootstrap por detecção de elementos da página.
- `api.js`: cliente central da API.
- `auth.js`: login/cadastro/sessão.
- `mockData.js`: combina placeholders e usuários reais.
- `swipe.js`: swipe, match, persistência de decisão, progresso de cards.
- `premium.js`: contador de likes pendentes + modal premium.
- `sessionNav.js`: nome + avatar da conta no topo.
- `profile.js`: edição do perfil, render de matches, desfazer match.

---

## 4) Fluxo de inicialização do frontend

Arquivo: `sabiocode/js/main.js`.

Na carga da página, o `bootstrap()` verifica presença de elementos:

- `#loginForm` + `#registerForm` -> inicializa `auth.js`
- `#cardStack` -> inicializa `swipe.js`
- `#premiumButton` -> inicializa `premium.js`
- `#sessionNavLink` -> inicializa `sessionNav.js`
- `#profileForm` -> inicializa `profile.js`

Esse padrão evita executar lógica desnecessária em páginas erradas.

---

## 5) Modelo de dados (local-db.json)

### Estrutura raiz

- `users: []`
- `swipes: []`
- `matches: []`

### `users` (campos principais)

Comuns:

- `email`, `password`, `role`, `location`, `isPremium`

Developer:

- `name`, `stack`, `phone`, `socials`, `contact`, `description`, `photos`

Company:

- `companyName`, `companyTechStack`, `salaryCeiling`, `companyPhoneRh`, `companySite`, `benefits`, `workModel`, `companyDescription`, `companyPhotos`, `contact`

### `swipes`

- `actorEmail`
- `targetEmail`
- `profileId`
- `decision` (`like`, `dislike`, `superlike`)
- `timestamp`

### `matches`

- `actorEmail` (dono do registro)
- `targetEmail` (outra conta do par)
- `profileId`
- `profileName`
- `profileRole`
- `unlockedContact`
- `matchedAt`
- `createdAt` / `updatedAt`

---

## 6) Endpoints da API

Arquivo: `server.js`.

### Usuários e autenticação

- `GET /api/users`
- `POST /api/auth/login`
- `POST /api/auth/register`
- `PUT /api/users`

### Swipe e likes

- `POST /api/swipes`
- `GET /api/swipes?actorEmail=&targetEmail=`
- `GET /api/likes-received?targetEmail=`

### Matches

- `GET /api/matches?actorEmail=`
- `POST /api/matches`
- `DELETE /api/matches` (remove nas duas contas)

### Regras de normalização

- `email` sempre em lowercase.
- `role` normalizado para `developer` ou `company`.

---

## 7) Regras de negócio críticas (leia antes de alterar)

## 7.1 Swipe e match

Em `swipe.js`:

- só há tentativa de match se decisão atual for `like/superlike`;
- validação de match considera apenas decisão recíproca mais recente da outra conta;
- após swipe, card avança para o próximo;
- progresso de cards vistos é salvo em `localStorage`.

## 7.2 Persistência de progresso de cards

- chave: `sabiocode_swipe_progress:<email>:<role>`
- guarda `profileId` já visto;
- botão "Ver tudo de novo" limpa progresso e reabre o feed.

## 7.3 Likes Premium (contador)

Endpoint `/api/likes-received` retorna likes pendentes:

- sobe quando alguém te curte;
- sai quando você já deu like/superlike recíproco mais novo;
- se match for desfeito, like antigo nao volta sozinho;
- só volta a contar se houver novo like da outra conta.

## 7.4 Desfazer match sincronizado

No `profile.js`:

- botão por item de match;
- confirmação via `window.confirm`;
- chama `DELETE /api/matches` com `actorEmail` e `targetEmail`;
- backend remove par nos dois sentidos (`A->B` e `B->A`).

---

## 8) Guia por módulo (onde mexer para cada funcionalidade)

## 8.1 Login/Cadastro

- HTML: `sabiocode/login.html`
- Lógica: `sabiocode/js/auth.js`
- API usada: `loginUser`, `registerUser`

Pontos de atenção:

- required dinâmico por modo e papel;
- upload de fotos com preview/reordenação;
- sessão salva em:
  - `sabiocode_user`
  - `sabiocode_session_active`

## 8.2 Navegação da sessão (nome + avatar)

- HTML: `#sessionNavLink` em `index.html`
- Lógica: `sabiocode/js/sessionNav.js`

Regra:

- conta `company`: avatar em `companyPhotos[0]`;
- conta `developer`: avatar em `photos[0]`.

## 8.3 Swipe board

- HTML: `sabiocode/index.html`
- CSS: `layout.css` + `components.css`
- Lógica: `sabiocode/js/swipe.js`
- Dados: `sabiocode/js/mockData.js` + `/api/users`

Recursos:

- drag por pointer + atalhos teclado;
- botões de decisão + botão voltar card;
- carrossel de fotos no card;
- modal de match;
- reset do feed.

## 8.4 Premium

- HTML: botão de estrela + modal premium em `index.html`
- Lógica: `sabiocode/js/premium.js`
- API: `/api/likes-received`

Comportamento:

- contador visível em conta logada;
- lista de curtidores apenas para `isPremium=true`;
- atualiza por timer, focus, visibilidade e evento de swipe.

## 8.5 Perfil e matches

- HTML: `sabiocode/profile.html`
- Lógica: `sabiocode/js/profile.js`

Recursos:

- editar dados por papel;
- salvar atualização;
- listar matches;
- desfazer match com confirmação.

---

## 9) Placeholders e dados mock

Arquivos:

- `sabiocode/js/placeholders/profiles/*.js`
- `sabiocode/assets/placeholders/*`

`mockData.js` combina:

- placeholders estáticos;
- usuários reais vindos da API;
- filtro por papel do usuário logado.

Regra:

- conta `developer` vê empresas;
- conta `company` vê developers.

---

## 10) Convenções do projeto

- comentários de integração:
  - `// BANCO DE DADOS AQUI`
  - `/* BACKEND AQUI */`
- emails normalizados em lowercase;
- papel único por conta (`developer` ou `company`);
- JS modular via `import/export`;
- CSS organizado com estilo BEM e componentes reutilizáveis.

---

## 11) Como adicionar uma nova feature sem quebrar o sistema

Passo sugerido:

1. identificar se impacto é de página, componente ou API;
2. alterar primeiro contrato de dados (`server.js` / `api.js`);
3. ajustar módulo específico de UI (`auth`, `swipe`, `premium`, `profile`);
4. garantir normalização de email/role;
5. validar sessão + fluxo entre duas contas;
6. testar persistência no `local-db.json`.

Checklist mínimo de teste manual:

- cadastro developer e company;
- login/logout;
- swipe like/dislike/superlike;
- match recíproco;
- contador premium;
- desfazer match em uma conta e validar remoção na outra;
- reset de feed e refresh de página.

---

## 12) Troubleshooting (problemas comuns)

### "Credenciais invalidas"

- conferir `email` em lowercase no banco;
- confirmar senha no `db/local-db.json`;
- confirmar sessão atual em `localStorage`.

### "API nao responde"

- confirmar `npm start`;
- validar logs do terminal;
- confirmar que está em `localhost:3000`.

### contador premium nao bate

- verificar `swipes` no banco;
- lembrar que conta apenas likes pendentes (não recíprocos);
- trocar de aba/voltar foco para forçar refresh.

### match nao aparece no perfil

- conferir existência de swipes recíprocos recentes;
- verificar se `POST /api/matches` foi chamado;
- checar registros criados para ambos os lados em `matches`.

---

## 13) Segurança e limites deste MVP

- sem autenticação JWT/sessão de servidor;
- sem hash de senha (senha em texto no JSON local);
- sem controle de concorrência no arquivo;
- foco é desenvolvimento local e validação de fluxo funcional.

Para produção, migrar para:

- backend framework com camadas;
- banco real;
- autenticação robusta;
- logs e observabilidade;
- validação avançada e rate limit.

---

## 14) Onboarding rápido para novos devs (passo a passo)

1. rodar `npm start`;
2. abrir `http://localhost:3000/sabiocode/login.html`;
3. cadastrar 2 contas (uma company e uma developer);
4. testar swipe dos dois lados;
5. validar match no perfil;
6. testar desfazer match;
7. testar contador premium;
8. ler os módulos na ordem:
   - `main.js`
   - `api.js`
   - `auth.js`
   - `mockData.js`
   - `swipe.js`
   - `premium.js`
   - `sessionNav.js`
   - `profile.js`
   - `server.js`

---

## 15) Resumo operacional para manutenção diária

- Toda mudança de regra de negócio deve passar por `server.js`.
- Toda mudança de consumo de API deve passar por `api.js`.
- Toda mudança de UX do swipe passa por `index.html` + `swipe.js` + CSS.
- Toda mudança de perfil/match passa por `profile.js` + `server.js`.
- Sempre testar com duas contas para validar reciprocidade.

Esse README deve ser atualizado sempre que:

- um endpoint mudar;
- um fluxo de regra mudar;
- um campo novo for adicionado em `users`, `swipes` ou `matches`.