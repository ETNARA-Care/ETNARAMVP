# ETNARA Frontend Agent State

## Current Status

## 2026-10-25 — Gate 6: «Llegué» separado de «Comenzar turno» (claude/llegue-arrival-clarity)
- **Textos:** «Comenzar turno» ya no dice que registra la llegada. Ahora dice «Iniciando turno…», «Turno iniciado» y, en la línea de tiempo, «Turno iniciado» / «Turno finalizado». La cola sin señal usa «Inicio del turno» y «Final del turno».
- **Con EN_CAMINO y sin «Llegué»** (ni guardado ni en cola): «Comenzar turno» abre «¿Registrar tu llegada primero?», con dos opciones: «Registrar «Llegué»» (lleva a la tarjeta) y «Comenzar sin «Llegué»» (inicia igual). Nunca bloquea.
- **Agencia** (`ShiftVisitPanel`, solo con EN_CAMINO): «Inició sin «Llegué»» por cuidadora; el retraso medido desde el inicio dice «Inició N min tarde».
- **Sin cambios de backend ni de API:** llegada, inicio y salida siguen siendo registros separados.
- **Pruebas:** 246/246 unitarias, tsc y build; E2E en iPhone 15/15; verificadores del backend en main: Gate 6 93/93, Gate 7 36/36, En Camino 27/27, Check-out 16/16, LocationPaste 33/33, OrgFeatures 15/15.

## 2026-10-24 — PR 0: recuperación de contraseña por correo (claude/password-recovery-email)
- «¿Olvidaste tu contraseña?» en el login → `/forgot-password` (mismo mensaje exista o no la cuenta) → correo con enlace → `/reset-password` (token leído una vez y quitado de la barra de direcciones; 12–128 caracteres con confirmación; enlace usado/vencido → «Pedir un enlace nuevo»; al terminar se cierra también la sesión local).
- Antes el correo enlazaba a `/reset-password`, que no existía: nadie podía recuperar su contraseña.
- Títulos del login y de estas pantallas con su tamaño real (`text-[length:var(--text-h1)]`; Tailwind v4 leía `text-[var(--text-h1)]` como color).
- Requiere el PR del backend `claude/password-recovery-email`. Pruebas: 199/199, typecheck, build; E2E iPhone en los tres portales 35/35.

## 2026-10-24 — En Camino: cancelación, reasignación y sin señal (claude/en-camino-fixes)
- **Cuidadora:** la tarjeta del recorrido se actualiza sola (cada 45 s y al volver a la app o recuperar la señal). Si la agencia cancela la visita o la quita del turno, ve un aviso claro.
- **Sin señal:** «Voy en camino» y «Llegué» quedan en la cola de envío (`careEventQueue`, con `clientEventId`) y se envían al volver la señal. «Llegué» sin señal no lleva lectura GPS y queda en revisión. El recorrido se guarda en la caché cifrada del teléfono.
- **Avisos nuevos en la campana:** `SHIFT_CANCELLED`, `SHIFT_UNASSIGNED`, `FAMILY_VISIT_CANCELLED` y `FAMILY_CAREGIVER_CHANGED`. El historial muestra la retirada del turno.
- **Requiere** la migración backend 112 (PR del backend `claude/en-camino-fixes`).
- **Pruebas:** typecheck, 187/187 y build. E2E en iPhone: cola sin señal, aviso de cancelación sin recargar, aviso de retirada en 1 s y textos de la campana.

## 2026-10-24 — Navegación unificada en los tres portales (ux/navegacion-unificada)

- layouts/PortalBottomNav.tsx: one bottom bar for Administrativo, Cuidador and
  Familiar with the Administrative measures (21 px icons, 11 px labels, salvia
  active line, translucent surface, Safari safe area). AdminMobileNav renders
  it (with its "Más" sheet); MobileTabBar removed. Caregiver/Family bars stay
  visible at every width (they have no sidebar); admin hides it from lg.
- Each portal keeps its sections and routes. Caregiver "Ofertas" still appears
  only when SmartMatch is enabled for the agency (unchanged).
- layouts/AccountMenu.tsx: the Administrative avatar menu (Configuración,
  Cerrar sesión, Cambiar organización when there are several) now in the
  three headers. Configuración → /agency/settings, /caregiver/profile,
  /family/profile. Caregiver logout asks to confirm when unsent offline
  records would be lost. Family header keeps logo and bell, adds the avatar.
- No change to SmartMatch, En Camino, shifts, permissions, patient data or
  backend.
- Validation: typecheck, 182 tests, build, lint unchanged (89). E2E at iPhone
  size (390×844, local backend) for the three roles: 42/42 with SmartMatch off
  and 43/43 with it on (login, every tab navigates and is active, avatar menu,
  Configuración, Cerrar sesión clears the session and blocks the portal; the
  three bars measure the same).

## 2026-10-23 — ETNARA Central mobile premium (claude/platform-mobile-premium)

- Rafa (iPhone): organization cards too big, modals cut off, top navigation too
  tall, «Funciones piloto» not found. Not merged / not deployed: PR for review.
- Root causes found: (1) Tailwind v4 reads `text-[var(--x)]` as a COLOR; the
  shared Button size class produced an invalid color, so buttons inherited the
  parent's (white «Actualizar» on white in the navy banner) — fixed with
  explicit `length:` keeping the rendered 1rem. The same ambiguity affects 396
  `text-[var(--text-*)]` classes app-wide (their sizes never applied): NOT
  changed here (would restyle every portal) — reported for a decision.
  (2) Safari collapses a 0% flex-basis inside a max-height column: modal body
  now `flex-auto`. (3) `--color-sage-*` only existed for [data-portal=admin]:
  added platform-theme.css (sage scale only). (4) `max-w-md` resolves to
  --spacing-md (24px) in this theme.
- PlatformLayout: phones get a 56px header + bottom navigation (safe area);
  md+ unchanged. Organizations: compact phone cards (initials, translated
  status chip, Ver resumen / Invitar / «Más» sheet for lifecycle), desktop
  layout kept. Modal `sheetOnMobile` / `eyebrow` / `wide` (platform only).
  «Funciones piloto»: switches show saved state; tapping opens the existing
  reason-required confirmation (no new API, no save on tap).
- Validation: typecheck, 178 tests (+6), build, lint (no new errors).
  Chromium iPhone emulation 320/375/393/430 + desktop 1280: no horizontal
  overflow, modals fit, both switches off, confirm disabled without reason,
  cancel keeps off, 0 JS errors, 0 feature events written. Button contrast
  scan across agency/caregiver/family/platform (phone+desktop): before 2
  invisible buttons, after 0. WebKit could not be installed in the sandbox:
  real Safari check on Rafa's iPhone pending.

## 2026-10-23 — Phase 12.6 bloqueo con Face ID / huella (ux/12.6-bloqueo-faceid)

- Rafa: password login already works with iPhone Face ID autofill; what was
  missing is protecting the 7-day kept caregiver session. Decision: lock on
  open and after 5 minutes away.
- offline/appLock.ts: WebAuthn platform credential (userVerification
  required, UV flag checked). Local screen lock: verified by the phone, so
  it works offline; credential id stored encrypted (secureStore); wiped on
  logout. Only kept caregiver sessions.
- AppLockGate in CaregiverLayout (inside the queue provider so pending
  records keep sending): portal stays mounted but hidden while locked.
  "Entrar con mi contraseña" signs out, warning about unsent records.
  One-time offer on Mi día; on/off in Más.
- Validation: typecheck, 125 tests, build, lint unchanged (76). Real-browser
  E2E with a virtual authenticator: 12/12 (lock on reopen, failed
  verification stays locked, unlock offline, off/on, password exit wipes the
  phone, administrators unaffected).

## 2026-10-23 — Phase 12.5 abrir sin señal desde cero (ux/12.5-abrir-sin-senal)

- public/sw.js: service worker with the app PROGRAM only (index.html, /assets,
  icons, fonts). API (other origin) never passes through it; navigation is
  network-first with the cached index.html as fallback. Each build stamps
  BUILD (vite plugin) so old copies are dropped. Manifest + apple meta so it
  can be added to the home screen (iOS keeps storage better that way).
- offline/shiftCache.ts (decision approved by Rafa 2026-10-23): for a kept
  caregiver session, the caregiver's own shifts that are not finished and
  start within 36 h — with their residents (filtered), care plan, address
  and visit records — are saved encrypted (secureStore) and restored on open.
  Expires 12 h after the last of those shifts (max 7 days); logout wipes it.
- Shifts page: open-shift offers no longer block the own shift list offline.
- Like "bajar el expediente" before a visit (Rafa's request): each upcoming
  shift shows "Listo para usar sin señal" once it is saved on the phone; the
  shift detail offers "Descargar para usar sin señal" when it is not yet.
- Fix: Today card for an in-progress shift kept the white Card background
  (white on white); now navy as designed.
- Validation: typecheck, 122 tests, build, lint unchanged (76). Real-browser
  E2E (service worker on localhost + local backend): 12/12 — opens from zero
  offline with today's shift, a shift 5 days away is not stored, offline
  check-in arrives marked offline, logout wipes the phone.

## 2026-10-23 — Security audit fixes (claude/smartmatch-frontend-v23)

- parseMapPoint: stray «%» no longer throws; out-of-range match tries next pattern; Apple «coordinate=».
- Offline cache forgets a remembered response on 401/403/404 (address after unassignment).
- Family arrival notice text «Llegada registrada»; «Llegué» outside its window explains when it opens.
- Open decision: production map tile provider (VITE_MAP_TILE_URL) — OSM public tiles are not for production.
- Checks: 157/157 static; E2E Gate 7 9/9, Gate 6 22/22, Turnos 13/13, Gate 5 21/21, Gate 4 22/22.

## 2026-10-23 — Gate 7 «ETNARA En Camino» (claude/smartmatch-frontend-v23)

- features/journey: CaregiverJourneyCard («Voy en camino», «Informar retraso» with minute chips and
  reason categories, window from start-2h to start+1h, no location), FamilyJourneyProgress (assigned →
  en camino → llegada registrada → servicio iniciado → finalizado, declared delay labelled «no es una
  hora estimada», cancellation), TodayJourneysPanel (Operaciones «Hoy en ruta», risks, preventive
  wording), ShiftJourneyHistory (agency «Historial operativo»). Bell labels/routes for 5 new notices.
- Checks: 153/153 static; lint 0 errors; build; audit 0. E2E 390x844: Gate 7 9/9, Gate 6 22/22,
  Turnos 13/13, Gate 5 21/21, Gate 4 22/22.

## 2026-10-23 — Gate 6 close: family form on iPhone, approval authorization (claude/smartmatch-frontend-v23)

- Modal follows window.visualViewport when fullScreenOnMobile (iOS keyboard): sheet height = visible
  area, buttons and focused field stay above the keyboard (data-keyboard-open).
- Family «Solicitar corrección»: full-screen sheet, one-row footer (Cancelar + Enviar a la agencia).
- Agency «Aprobar corrección»: current vs proposed address; when upcoming shifts use it, warning +
  required «Autorizo…» checkbox -> confirmUpcomingShifts. Full-screen on mobile.
- Checks: 148/148 static; E2E 390x844 Gate 6 22/22 (FM1 keyboard-aware family form, FM2 approval
  with shifts), Turnos 13/13, Gate 5 21/21, Gate 4 22/22.

## 2026-10-23 — Gate 6 fix: «Ubicar en el mapa», GPS state, iPhone forms (claude/smartmatch-frontend-v23)

- Badges «Dirección verificada / sin verificar» and «GPS confirmado / sin confirmar» are independent.
- GpsConfirmModal: local search only (municipality centres from Census centroids; pasted Apple/Google
  Maps link or "lat, lng" parsed locally, PR bounds), tap/drag marker, preview, required checkbox,
  «Confirmar GPS». Opens after adding an address; «Corregir punto» later. No geocoding provider.
- Map removed from the address form. Modal fullScreenOnMobile (100dvh sheet, header/footer z-10 with
  background, safe areas, focused field scrolled into view); Leaflet container isolate z-0.
  Tile URL/attribution configurable (VITE_MAP_TILE_URL / VITE_MAP_TILE_ATTRIBUTION).
- Turnos: LocationSelect shows GPS state per option and a non-blocking warning. Cómo llegar: Apple,
  Google, Waze use coordinates only when confirmed; otherwise written address + «Destino aproximado».
- Checks: tsc, lint (0 errors), 146/146 static tests, build; E2E 390x844: Gate 6 20/20, Turnos 13/13,
  Gate 5 21/21, Gate 4 22/22. Chromium only (no WebKit here) -> iPhone check is manual.

## 2026-10-23 — Gate 6: service location, Cómo llegar, Llegué (claude/smartmatch-frontend-v23)

- Resident record: «Ubicación del servicio» (ServiceLocationSection) replaces the Phase 12.1 card:
  addresses, ZIP, access notes, Leaflet + OpenStreetMap marker (no geocoding; leaflet 1.9.4 pinned),
  verify, primary, archive, history + caregiver access log, family permission, correction requests,
  explicit «Actualizar turnos» when the primary address changes.
- Turnos forms: «Dirección del servicio» (primary preselected; SmartMatch requires a choice).
- Caregiver: «Cómo llegar» from the shift's confirmed location (Apple Maps, Google Maps, Waze);
  «Llegué» with one-time consent modal, one getCurrentPosition reading, never blocks «Comenzar turno»;
  consent card in profile. Agency shift detail: address, real times, lateness, arrival review.
- Family profile: «Lugar del servicio» (permission-gated) + correction request and status.
- SmartMatch: cancel FILLED with reason; active shift sends the admin to Turnos.
- Tests 142/142; E2E 390x844: Gate 6 16/16, Turnos 13/13, Gate 5 21/21, Gate 4 22/22.

## 2026-10-23 — SmartMatch Gate 5: Crear turno con esta cuidadora (claude/smartmatch-frontend-v23)

- After approval: "Solicitud aprobada" prompt with «Crear turno con esta cuidadora» / «Más tarde».
- Filled cards: «Cubierta — pendiente de asignación» + button, or «Turno creado · …» + «Ver turno».
- /agency/shifts?create=1&smartmatch=<id>: the Turnos create form in SmartMatch mode (caregiver and
  schedule fixed, person receiving care from the agency, private instructions, one server call).
- ShiftPrivateInstructions card: agency shift detail (editable) and caregiver shift detail (read).
- Tests 134/134; browser E2E 390x844: Turnos 13/13, Gate 5 21/21, Gate 4 22/22.

## 2026-10-23 — SmartMatch Gate 5: notifications, dashboard panel, mobile fixes (claude/smartmatch-frontend-v23)

- Bell: numeric badge (9+), "Marcar todas", SmartMatch notifications deep-link to the exact
  application (/agency/smartmatch?application=, /caregiver/smartmatch?tab=mine&application=).
- Agency overview: SmartMatch panel (admins only): Pendientes / Publicadas / Cubiertas + Revisar.
- Mobile: ScrollToTop on route change; Modal fits 100dvh with scrolling body and safe-area footer;
  es-PR explicit date parts; short privacy lines; role Select + "Otro" mirroring server validation.
- tests/smartmatch-gate5.test.mjs (6). Browser E2E 390x844: Gate 5 21/21, Gate 4 22/22.

## 2026-10-22 — SmartMatch Gate 4: UI in frontend-v23 (claude/smartmatch-frontend-v23)

- SmartMatch was only in the legacy `frontend/` (not deployed). Integrated into `frontend-v23/`
  with the existing UI kit and layouts: /caregiver/smartmatch (bottom tab "Ofertas") and
  /agency/smartmatch (Operación group; hidden for supervisors, like billing).
- Caregiver: list, 78-municipality filter, apply with explicit consent (smartmatch-consent-v1),
  Mis solicitudes with full history, withdraw, re-apply. No travel-time estimates shown.
- Agency: create draft, publish by any admin, review queue, live eligibility checks, approve
  (disabled unless verifiable, then confirmed) / reject (confirmed), decision history, Cubiertas.
- Tab label is "Ofertas": at 360px "Mensajes" already fills its 72px tab, longer labels touched.
- Tests: tests/smartmatch-gate4.test.mjs (static); real-browser E2E at 390x844 against the local
  backend as app_runtime with two synthetic agencies: 22/22.
- Requires backend PR ETNARA-Care/ETNARA-Backend#198 (endpoints).
## 2026-10-22 — Phase 12.4 modo sin señal (ux/12.4-modo-sin-senal)

- offline/secureStore.ts: IndexedDB + AES-GCM with a non-extractable key; each
  value expires (max 7 days); logout clears everything including the key.
- auth/token.ts: decision change approved by Rafa — a caregiver-only session
  (backend keepSignedIn) is kept encrypted on the device up to 7 days and
  restored on open; all other sessions stay tab-only (sessionStorage).
  AuthProvider opens with the cached identity when there is no signal and
  re-checks with the server when it returns.
- Care event queue now also holds check-in/check-out, in order, each with its
  own clientEventId and real time; saved encrypted per user for kept
  sessions (memory only otherwise). A queued visit shows as started/finished.
  Finishing with pending records is allowed only when the queue is saved.
- api/client.ts: caregiver shift reads remembered in memory only (never on
  disk) so screens keep working when signal drops; 20 s request timeout
  counts as no signal. Upcoming shift details prefetched while online.
- "Sin señal" notice; lists show "Sin conexión" and reload when signal
  returns. Agency timesheets show "Registrada sin conexión".
- Known limit: if the app is closed with no signal, reopening shows no shift
  list (only pending records persist). Decision pending with Rafa.
- Validation: typecheck, 118 tests, build; lint unchanged (76). Real-browser
  E2E against the local backend: 17/17.

## 2026-10-22 — Phase 12.3 supervisor from caregiver + existing accounts (ux/12.3-supervisora-cuenta-existente)

- roles.ts allowedExperiences: staff who also work shifts open both /agency
  (default) and /caregiver. RoleGuard allows any allowed portal. Agency sidebar
  "Mi día como cuidador/a"; caregiver portal "Ir a la agencia".
- StaffRoleCard on the caregiver profile (administrators only): "Hacer
  supervisor/a" / "Quitar supervisor/a" via POST /team/roles.
- TeamPanel: "También cuidador/a" badge and "Quitar …" per role (not self);
  clearer ALREADY_A_MEMBER message.
- Invitation page: existing account signs in on the page and accepts via
  POST /platform/admin-invitations/accept; identity mismatch explained.
- Organization picker: readable heading, Spanish type and role labels.
- Validation: typecheck, 112 tests, build; lint unchanged (76). Full flow
  checked against a local backend.

## 2026-10-22 — Messages and care quality (ux/agency-messages-quality)

- RealMessagingPanel names each conversation by its resident (agency and
  caregiver via listCareRecipients; family via its relatives), sorts by the
  latest message and shows its time. Mobile rows keep the name readable.
- Agency: "Nuevo mensaje" picks a resident and opens or creates its
  conversation through POST /care-recipients/:id/conversation (backend checks
  access). New api/messaging openRecipientConversation.
- Calidad del cuidado runs its review when the page opens (deterministic, no
  AI) instead of showing an empty page.
- Validation: typecheck, 109 tests, build; lint unchanged (76). Checked against
  a local backend: new conversation about José Méndez, message sent, list order.

## 2026-10-22 — Phase 12.2 agency team (ux/12.2-equipo-agencia)

- api/team.ts + features/agency/TeamPanel.tsx: Configuración → "Equipo" for
  ORGANIZATION_ADMIN only — list administrators/supervisors, invite by email
  with role (Supervisor | Administrador), cancel pending invitations, copy the
  activation link when the email cannot be sent.
- Activation page (/invite/organization-admin) names the invited role.
- Supervisors: "Horas y facturación" removed from navigation and the page shows
  an administrator-only notice (backend 085 also returns 403 and RLS denies).
- Validation: typecheck, 105 tests, build; lint unchanged (76). Full flow
  checked against a local backend: invite → activate → sign in as supervisor.
- Pairs with ETNARA-Backend gate/12.2-team-invitations-admin-authority.

## 2026-10-22 — Agency plain language and missing rates (fix/agency-plain-language-and-rates)

- Removed internal jargon from agency screens ("B2B", "endpoint", "briefing",
  "Family conserva endpoints"); buttons now say "Generar resumen".
- Real plurals instead of "(s)"/"(es)" via overviewModel `plural`.
- Dates without seconds (dateStyle medium + timeStyle short).
- Horas y facturación: warning "Falta(n) la(s) tarifa(s) de …" with "Poner
  tarifa", plus "Falta tarifa" on each row without rates.
- Validation: typecheck, 101 tests, build; lint unchanged (76 pre-existing).
- Pairs with ETNARA-Backend fix/agency-plain-language.

## 2026-10-22 — Agency coverage and compliance truth (fix/agency-coverage-compliance-truth)

- New `features/agency/shiftCoverage.ts`: one coverage rule for the agency
  portal, matching the backend operations center — covered only when the
  caregiver ACCEPTED; pending = "Esperando respuesta"; accepted + 15 min past
  start without check-in = "Sin llegada".
- useAgencySupervision exposes `assignmentResponse`. Briefing ("Turnos
  confirmados hoy"), ShiftBoard, Shifts list and Residents list use the rule.
  Removed the double "Sin asignar" + "Esperando respuesta" badges.
- Compliance: with zero active establishments the establishment panel no
  longer counts 5 "faltantes" against a nonexistent establishment; the
  residents card explains establishment requirements; readiness ring says
  "Sin establecimientos".
- Validation: typecheck, 97 tests, build; lint unchanged (76 pre-existing).
  Checked against a local backend with seeded demo data.
- Pairs with ETNARA-Backend fix/coverage-truth-and-alert-time.

## 2026-10-21 — Phase 12.1 "Cómo llegar" (ux/12.1-como-llegar)

- Added `api/recipientLocation.ts` (shared client; 404 = no access → null).
- Added `features/caregiver/directions.ts` (address text, Google Maps and Waze
  links preferring coordinates, coordinate parsing) and `DirectionsCard.tsx`.
- Caregiver shift detail loads the location without blocking the shift and
  shows the card until the visit is completed or cancelled.
- Agency resident profile has a "Dirección y acceso" card and editor.
- Family pages do not call the location endpoint (asserted in tests).
- Validation: typecheck, 82 tests, build; lint unchanged (75 pre-existing
  warnings, none new). Screenshots checked with a mocked API.
- Exact next step: publish only after Railway returns, backend #185 is merged
  and migration 084 is applied.
## 2026-10-21 — Caregiver offline-safe care records (ux/cuidador-sin-senal)

- `features/caregiver/careEventQueue.ts` (contract + helpers) and
  `CareEventQueueProvider.tsx` (provider + banner). The queue lives in memory only.
- Saving a care record sends `clientEventId` + `occurredAt`. Connectivity failures
  queue the record; other API errors surface immediately as before.
- Shift detail lists pending records in the activity, blocks "Finalizar turno"
  while any are pending and shows server-rejected records with a "Quitar" action.
- Simulated offline → online with intercepted requests: one queued record, banner,
  finish blocked, delivered on retry with the same clientEventId and occurredAt.
- Typecheck, lint (no new warnings), 82 tests and build pass.
- Exact next step: publish after backend PR #181 and migrations 080/081 on Railway.

## 2026-10-21 — Family relatives and daily summary (ux/familia-familiares-resumen)

- Added `features/family/familyRecipient.ts` (selection helpers + context) and
  `FamilyRecipientContext.tsx` (provider + switcher). FamilyLayout wraps the
  portal; the switcher only renders when the account has 2+ relatives.
- Today, Activity, History and Profile resolve the relative with
  `pickRecipient(recipients, activeOrganization?.id, selectedKey)` and reload on change.
- `features/family/dailySummary.ts` builds "Resumen de hoy" from the curated
  family timeline only (MEAL, HYDRATION, MOBILITY/ACTIVITY, latest MOOD).
- Fixed the unreadable status pill on the navy hero and the "last update" line.
- Reviewed at 390 px with intercepted fixtures (two relatives). Typecheck, lint
  (existing warnings only), 77 tests and build pass.

## 2026-10-21 — UX priorities for Caregiver and Family (ux/cuidador-familia-prioridades)

- Caregiver header now mounts the existing real NotificationBell; its
  caregiver routing (assignments and open-shift offers) already existed.
- Caregiver "Mi día" shows a card with pending open-shift offers from the real
  `/me/coverage-offers` contract; a failure there never hides the worker's own shifts.
- Caregiver shift detail renders one state-driven primary action: accept or
  reject, "Comenzar turno", then the care grid and incident report while active,
  then the care plan and "Finalizar turno". No contract or permission change.
- Family Today no longer shows an amber warning or "Aún sin cuidador asignado"
  when there is no shift; it shows a calm state with a link to agency messages.
- Reviewed at 390 px with intercepted API fixtures. Typecheck, lint (existing
  warnings only), 74 tests and production build pass.
- Exact next step: Rafa reviews the PR; recipient address needs a backend gate (FUX-002).

Project: ETNARA Care
Branch: design/claude-admin-full-integration

## 2026-10-05 — Admin Portal visual system (design/claude-admin-full-integration)

- Applied the approved Claude Admin Portal design to the whole Agency
 experience, not only the Overview: new app shell (navy sidebar with
 Operación / Cuidado / Administración groups, topbar with active
 organization, organization switch link, notifications and account menu),
 mobile bottom navigation (Inicio, Compliance, Turnos, Residentes, Más) and
 a “Más” sheet with every Agency section.
- Visual tokens live in `src/styles/admin-theme.css`, scoped to
 `[data-portal="admin"]` (set by AgencyLayout). Family and Caregiver keep the
 base tokens; shared primitives only gained inert `data-ui` attributes.
- Overview is an action-oriented command center built only on existing
 contracts: Operations Center alerts (“Hoy hay X asuntos urgentes y Y por
 planificar”), resident record readiness, today’s shift timeline, workforce
 alerts, expiring documents, incidents, care activity and quick actions.
 No mock data and no new endpoints.
- Resident document readiness moved unchanged into
 `features/agency/useResidentCompliance.ts`, shared by Compliance and Overview.
- Platform access stays limited to `isPlatformAdmin`; no backend, auth, role or
 tenant-isolation change.
- Fixed Tailwind v4 named-size conflicts with ETNARA spacing tokens
 (`max-w-lg` resolved to 2rem) by using explicit widths.
- Reviewed Overview, Compliance, Personal, Residentes, Turnos and Incidentes at
 390 px and 1440 px with intercepted API fixtures: no horizontal overflow.
- Exact next step: apply the patch on a branch, open the PR, verify the GitHub
 Pages preview against Railway with a real organization admin account.
Branch: phase-10/10.0-multi-agency-compliance
## 2026-09-27 — Phase 10.0 multi-agency establishments

- Replaced the empty organization-settings placeholder with a real
  manager-facing establishment workspace backed by the existing API tenant.
- The screen names the active organization and explains that residents,
  personnel, shifts and documents remain exclusive to it.
- Users with multiple memberships can return to the existing organization
  selector; no combined or cross-agency view was introduced.
- Managers can add, edit, archive and reactivate establishments with loading,
  empty, error and mutation feedback states and no mock fallback.
- Exact next step: complete validation, publish after the backend PR, then
  verify the deployed GitHub Pages interface against Railway.

## 2026-09-26 — Phase 9.4 B2B Agent Center

- Added one “Centro de agentes” destination for the four existing Agency
  briefings: Operations, Compliance, Coverage and Care Quality.
- A combined manager-requested analysis uses each existing protected contract
  and preserves successful cards when another agent fails.
- The product map makes Compliance, Workforce, Care and Family explicit while
  keeping Family outside organization-wide agent requests.
- The center performs no operational mutation and keeps advisory mode and
  human control visible.
- Added dedicated regressions for the Agent Center and the existing Phase 7.9
  pay-period surface.
- Published and merged in frontend PR #63 after typecheck, all 68 tests,
  production build and CI passed.

## 2026-09-26 — Phase 9.3 assisted Care Quality Agent

- Added a dedicated “Calidad” destination for authorized Agency users.
- Administration explicitly requests a briefing and receives real counts plus
  up to five ranked documentation or follow-up gaps with authoritative links.
- Advisory mode and human control remain visible; the UI never implies that a
  note, verification, observation or incident changed.
- There is no mock fallback and Family has no quality route or API request.
- Published and merged in frontend PR #62 after typecheck, all 65 tests,
  production build and CI passed; GitHub Pages serves the quality workspace.

## 2026-09-26 — Phase 9.2 assisted Coverage Agent

- Added an “Agente de Cobertura” briefing inside the real Agency shifts page.
- Administration explicitly requests analysis and receives up to five ranked
  uncovered shifts with urgency, eligible-option counts and authoritative links.
- Advisory mode and human control remain visible; the UI never implies that an
  offer, campaign or assignment changed.
- There is no mock fallback and Family has no agent route or API request.
- Published and merged in frontend PR #61 after typecheck, 62/62 tests, build
  and CI passed; GitHub Pages serves the Coverage Agent bundle.

## 2026-09-26 — Phase 9.1 assisted Compliance Agent

- Added an “Agente de Cumplimiento” briefing inside the real Agency compliance
  center.
- Administration explicitly requests analysis and receives up to five ranked
  caregivers with reasons, recommendations and existing workflow actions.
- Advisory mode and human control remain visible; the UI never implies that a
  credential, eligibility value, membership or policy changed.
- There is no mock fallback and Family has no agent route or API request.
- Published and merged in frontend PR #60 after typecheck, 59/59 tests, build
  and CI passed; GitHub Pages serves the Compliance Agent bundle.

## 2026-09-26 — Phase 9.0 assisted Operations Agent

- Added an “Agente de Operaciones” surface inside the real Agency operational
  center.
- Administration explicitly requests a briefing and receives up to five
  ranked priorities with reasons, recommendations and authoritative actions.
- The interface identifies advisory mode and human control; it never presents
  a recommendation as an executed decision.
- There is no mock fallback and Family has no agent route or API request.
- Published and merged in frontend PR #59 after typecheck, 56/56 tests, build
  and CI passed; GitHub Pages serves the Operations Agent bundle.

## 2026-09-26 — Phase 8.0 agency operations and automation

- Added “Centro operacional” to Agency with a real manager-authorized API and
  automatic one-minute refresh.
- The page prioritizes uncovered shifts, missed check-ins, expiring
  credentials, unresolved incidents and hours requiring review.
- Alerts open existing workflows and can be escalated once to active
  Supervisors; no operational decision is performed automatically.
- Family has no route or API dependency for organization-wide alerts.
- Published and merged in frontend PR #58 after typecheck, 53/53 tests, build
  and CI passed; GitHub Pages serves the operational center bundle.

## 2026-09-22 — Phase 7.7 planning runtime hotfix

- Replaced the ambiguous `max-w-xs` planning-selector constraint with a full
  mobile width and an explicit 320 px desktop maximum.
- The custom ETNARA spacing token named `xs` had caused Tailwind to compile
  `max-w-xs` as 0.75 rem instead of the expected container width.
- Added a regression that prevents the narrow class from returning.
- Frontend PR #51 was merged after typecheck, production build, 50/50 tests,
  lint and diff-safety checks passed.
- GitHub Pages deployment succeeded; the public CSS contains the explicit
  320 px maximum and the public bundle contains the Planning screen.
- Exact next step: validate the selector and authenticated forecast on mobile.

## 2026-09-21 — Phase 7.7 predictive workforce planning

- Added a new Administration destination, “Planificación”, backed only by the
  real manager-authorized workforce forecast API.
- Administration can analyze 7, 14 or 30 days and see daily risk, required and
  known available hours, role-specific gaps and uncovered shifts.
- ETNARA explains uncertainty when eligible caregivers have not configured
  availability and surfaces credentials that expire inside the horizon.
- Recommended actions link to existing human workflows; the page never assigns
  a caregiver or starts a coverage campaign automatically.
- New shifts persist the selected caregiver role as forecast demand.
- Typecheck, production build and 49/49 tests pass; lint retains only existing
  repository warnings.
- Exact next step: review the final diff and publish with the backend only after
  explicit authorization.

## 2026-09-21 — Persistent platform navigation hotfix

- Confirmed that the root redirect correctly opens `/platform` for a platform
  administrator, but Agency had no return link after selecting “Agencia”.
- Added “Plataforma” to the Agency sidebar and mobile drawer only when the
  authenticated `/me` result grants independent platform authority.
- Ordinary organization administrators, supervisors and caregivers never see
  the link, and `/platform` remains protected by `PlatformGuard`.
- Frontend validation passed: typecheck, production build, 45/45 tests and
  lint; lint retains only existing warnings. `git diff --check` also passed.
- Published and merged in frontend PR #49; pull-request CI, post-merge CI and
  GitHub Pages deployment passed.

## 2026-09-21 — Phase 7.6.2 compliance self-service

- The existing Cumplimiento page is now an operational center: it shows exact
  worker causes, policies by caregiver role, access/invitation guidance and an
  auditable administrative history.
- Admin/Supervisor can select credential types, decide whether each is
  mandatory and require an additional agency review; saving uses only the real
  backend configuration endpoint.
- Platform defaults are clearly distinguished from organization policies and
  can be adopted as the starting point for a role-specific policy.
- The worker detail action leads to the existing credential and secure-access
  controls rather than duplicating invitation behavior.
- Frontend PR #46 was merged after typecheck, production build, 45/45 tests,
  lint and every CI check passed; lint retained only existing warnings.
- Credential-document upload remains intentionally deferred to the final
  technical close and does not block this phase.
- GitHub Pages deployed successfully and the live bundle contains the new
  requirements, audit and access surfaces.
- Exact next step: configure and verify one role policy on mobile.

## 2026-09-20 — Caregiver identity hotfix

- Removed the fixed “María Rivera” name and “Cuidadora certificada” label from
  the caregiver header and profile.
- The avatar, name and role now come from the authenticated worker profile for
  the active organization; email is only a safe fallback when no display name
  has been registered.
- Credentials remain account-specific and continue using the existing real
  credential endpoint.
- Frontend PR #44 was merged after typecheck/build, 43/43 tests, lint and diff
  safety passed; lint retained only the repository's existing warnings.
- GitHub Pages serves the new worker-profile contract and no longer contains
  the fixed “Cuidadora certificada” profile label.
- Exact next step: validate Carlos and Rafael after signing out and back in.

## 2026-09-20 — Phase 7.6.1 platform credential verification

- Added an exclusive platform-administration experience backed by the real
  server-side `platform_admins` authority rather than an organization role.
- The queue shows current credential files, organization context and the latest
  current-version decision, with signed private document viewing.
- Platform administrators can verify or reject; rejection requires a reason
  and work eligibility is recalculated by the backend automatically.
- Agency compliance surfaces now distinguish a pending verification from a
  rejected one; there is no manual “mark apt” control.
- Frontend PR #42 was merged after typecheck/build, 42/42 tests, lint and diff
  safety passed; lint retained only the repository's existing warnings.
- GitHub Pages deployment succeeded after Railway served the protected backend
  route; the public bundle contains the platform queue and review interface.
- Exact next step: validate one approval and one rejection on mobile using the
  demo platform administrator.

## 2026-09-20 — Phase 7.5 staged coverage escalation

- Administration now sees the active wave, interested and pending responses,
  queued candidates and the next automatic wave time on the existing shift card.
- An interested response visibly stops escalation while preserving the existing
  human-only final assignment button.
- Exhausted campaigns explain that all eligible staff were consulted and allow
  Administration to retry without deleting prior history.
- Caregivers see the response deadline while resident identity and clinical
  information remain hidden before final assignment.
- The Administration view refreshes coverage state every 30 seconds without a
  mock fallback or visual redesign.
- Frontend PR #40 was merged after typecheck, 39/39 tests, production build,
  lint and diff safety passed.
- GitHub Pages deployment succeeded after backend PR #37 was healthy; the live
  public bundle contains the Phase 7.5 wave progress and response deadline UI.
- Exact next step: validate one timed second-wave progression with real roles.

## 2026-09-20 — Phase 7.4 collaborative open-shift offers

- Administration can send an uncovered shift to the top three real coverage
  recommendations and monitor pending and interested responses.
- Interested caregiver names appear beside the shift so the administrator can
  make the final assignment through the existing confirmed workflow.
- Caregivers see only date, time and requested role before assignment and must
  confirm whether they are available; no resident or clinical data is exposed.
- New offer and response notifications open the correct role-specific shift view.
- Typecheck, 36/36 boundary tests, production build and lint pass; lint retains
  only the existing project warnings.
- Published and merged in frontend PR #38 after backend PR #34 was live.
  Pull-request CI, post-merge CI and GitHub Pages deployment passed; the public
  bundle contains the Phase 7.4 offer and response workflow.
- Exact next step: validate the complete responsive flow with real Admin and
  caregiver roles on mobile.

## 2026-09-20 — Phase 7.3 worker-declared availability

- The caregiver profile now manages real weekly availability and future
  vacation, appointment or other unavailable periods.
- The interface loads and saves only through the authenticated organization API
  and clearly distinguishes pending from configured availability.
- Administration coverage recommendations consume the backend's declared-
  availability reasons while retaining explicit human assignment confirmation.
- Typecheck, 33/33 boundary tests, production build and lint pass; lint retains
  only the existing project warnings.
- Published and merged in frontend PR #36 after backend PR #31 was live.
  Pull-request CI, post-merge CI and GitHub Pages deployment passed; the public
  portal returned HTTP 200 with the availability interface in its live bundle.
- Exact next step: validate saving availability and coverage blocking on mobile.

## 2026-09-19 — Phase 7.2 assisted coverage intelligence

- Administration can request real coverage recommendations while creating or
  assigning a shift.
- The ranked options explain eligibility, schedule conflicts, continuity with
  the resident and scheduled load over the next seven days.
- Conflicted or ineligible options are disabled; ETNARA recommends but the
  administrator must explicitly confirm the assignment.
- Typecheck, 31/31 boundary tests, production build and lint pass; lint retains
  only the existing project warnings.
- Published and merged in frontend PR #35 after backend PR #30 was live.
  Pull-request CI, post-merge CI and GitHub Pages deployment passed; the public
  portal returned HTTP 200.
- Exact next step: validate one recommended and one blocked candidate on mobile.

## 2026-09-19 — Actionable Administration Overview

- The Administration Overview now includes direct actions for creating a
  shift and opening residents, caregivers and incidents.
- All four summary metrics are interactive; shift and activity rows now open
  their corresponding real-data detail screens.
- The empty-day state can start the existing create-and-assign shift workflow.
- The shift page accepts `?create=1` and opens that existing workflow without
  adding a duplicate form or mock state.
- Typecheck, 29/29 boundary tests, production build and lint pass; lint retains
  only the existing project warnings.
- Published and merged in frontend PR #34. Pull-request CI, post-merge CI and
  the GitHub Pages deployment passed; the public portal returned HTTP 200.
- Exact next step: validate the new actions while signed in as Administration
  on mobile, then continue with the next Phase 7 increment.

## 2026-09-19 — Phase 7.1 individual care plans

- Administration can create or update the active plan from the real resident
  profile; each save is a new backend version.
- The plan captures support level, goals, instructions, precautions and
  structured tasks with category, frequency, suggested time and priority.
- Assigned caregivers see the active plan inside the real shift detail.
- Family has no care-plan route in this delivery and no mock fallback was
  introduced.
- Typecheck, 27/27 boundary tests and production build pass; lint retains only
  the existing warnings.
- Phase 7.1 was published and merged in frontend PR #33 after the coordinated
  backend PR #29; post-merge CI and deployment checks passed.

## 2026-09-15 — Phase 6 end-to-end operational synchronization

- Family Today now shows only a shift scheduled for the current local day;
  it no longer labels a future shift as today's care.
- Administration resolves the active caregiver from accepted, then pending,
  assignments and never treats a rejected historical response as coverage.
- Administration supervision, shift detail and Family Today refresh every 30
  seconds and when the browser regains focus, while preserving manual retry.
- Shift-started and shift-completed notifications navigate Admin to the shift
  and Family to its safe Today view.
- Existing real APIs for activities, incidents, messages and notifications
  remain in place; no mock fallback or UI redesign was added.
- Phase 5.9 private-document transport remains deferred and isolated.
- Typecheck, 24/24 boundary tests and production build pass. Lint reports only
  the existing project warnings.
- Exact next step: publish after the backend PR, wait for Railway and Pages,
  then validate one complete Admin → María → Family shift.

## 2026-09-15 — Phase 5.10 work eligibility enforcement

- Worker profiles now show employment membership and work eligibility as two
  independent states.
- Administration sees the exact unmet mandatory requirements on the profile
  and in Compliance, including revoked credentials.
- Shift creation and assignment load fresh backend compliance, mark eligible
  workers as apt and disable workers who are not eligible with a bounded reason.
- Reactivation copy no longer implies that an active worker can immediately
  work; mandatory requirements must still pass.
- Phase 5.9 document transport remains deferred and isolated from this phase.
- Typecheck, 23/23 boundary tests, production build and lint pass; lint retains
  only the pre-existing warnings.
- Exact next step: publish after explicit authorization, deploy backend first,
  then validate one blocked and one allowed assignment.

## 2026-09-13 — Secure credential upload hotfix

- Replaced the browser-to-bucket PUT with an authenticated binary POST through
  the existing API client and backend.
- The UI, accepted document types, 10 MB limit, completion step, document
  versioning and review workflow remain unchanged.
- No mock fallback or direct bucket credential is introduced in the browser.
- Typecheck, 22/22 boundary tests and production build pass; lint reports only
  the pre-existing warnings.
- Exact next step: publish after the backend PR, merge, wait for Pages, and
  validate one credential document upload from Safari.

## Last Known Frontend Checkpoint

Backend connectivity is working.

Known product issue:
- Administration Workers has been migrated to real organization data locally.
- The active Agency resident profile is backed by real organization data.
- Caregiver / Family / Administration synchronization still requires frontend validation.
- Messaging backend fixes may exist or be pending deployment depending on backend state.
- Family-safe endpoints for observations/incidents/shifts exist and must be used rather than raw endpoints.

## Mandatory Next Step

Before implementing frontend changes:

1. Inspect git status
2. Inspect git diff
3. Locate AgencyResidentProfilePage.tsx
4. Identify mock/demo/local state dependencies
5. Confirm available backend endpoints before changing UI
6. Do not redesign the page

## Current Product Priority

1. Administration real data
2. Messaging across Worker / Family / Admin
3. Timeline / care events
4. Shifts / check-in / check-out
5. Notifications
6. Family-safe observations / incidents
7. Remove remaining mocks from real product flows

## Deployment

Frontend deploys through GitHub Pages.

Verify GitHub Actions deployment before assuming new code is live.

## Session Handoff

### 2026-09-12 — Phase 5.5 real Administration compliance

- Replaced the empty Administration Compliance placeholder with real,
  organization-scoped workforce, credential and eligibility data.
- Summary metrics distinguish active personnel, fully compliant workers and
  workers requiring attention without double-counting credential alerts.
- Caregiver rows remain compact and expand on demand to show requirement
  failures, organization-review needs and credential expiration/revocation
  alerts; full worker profiles remain one action away.
- No mock fallback or Family-facing contract is involved; the existing
  manager-authorized `/workers/:membershipId/compliance` contract remains
  authoritative.
- Exact next step: finish validation, review the diff and publish only with
  explicit authorization.

### 2026-09-12 — Phase 5.4 Admin workflows and actionable notifications

- Notification items now open the exact authorized shift, incident,
  conversation, care activity, or resident destination and mark themselves
  read without losing navigation context.
- Admin shift detail shows caregiver responses, response time, rejection
  reason (or `Sin motivo indicado`) and a confirmed safe cancellation action.
- Worker cards are compact and open a dedicated real-data profile with work
  information and credential status.
- The Agency mobile drawer is narrower, uses stronger contrast and safe-area
  spacing, labels Overview as Resumen, and derives organization/user avatars
  from authenticated data instead of conflicting hard-coded initials.
- Typecheck, 16/16 boundary tests, lint (pre-existing warnings only), and the
  production build pass.
- Exact next step: publish only after backend migration 044 is merged and live,
  then wait for Pages and validate notification click-through and cancellation.

### 2026-09-11 — Phase 5.3 operational shift cleanup

- Administration now excludes completed, cancelled, and other expired shifts
  from the active assignment list while preserving in-progress shifts.
- Historical rows remain in the backend for audit; no records are deleted.
- Assignment lookups now run only for the operational rows shown on screen.
- The empty state now accurately says there are no active shifts.
- Local typecheck, 14/14 tests, lint (pre-existing warnings only), and the
  production build pass.
- Exact next step: publish and merge after backend migration 043 passes CI,
  wait for Pages, then verify the old September 8/10 cards are absent.

### 2026-09-10 — Align GitHub Pages with the active Railway backend

- The public V23 bundle was proven to call the obsolete `d460` Railway
  endpoint while the maintained backend and its logs run on `2a3a`.
- CI and Pages now build against the same active `2a3a` endpoint.
- Added a regression test that prevents either workflow from returning to the
  obsolete endpoint.
- No UI, API contract, role permission, or backend code changed.
- Typecheck, lint, 13/13 tests and the production build pass locally.
- Exact next step: publish, wait for Pages, sign in again, and validate one new
  Admin → María assignment response against `2a3a`.

### 2026-09-09 — Phase 5.2 caregiver assignment response

- Caregiver shifts expose the real pending/accepted assignment state.
- María can accept or reject from the shift detail; rejection supports an
  optional reason.
- Start and care controls remain disabled until acceptance.
- Administration distinguishes “Esperando respuesta” from “Aceptado” and a
  rejected shift becomes assignable again.
- Frontend typecheck, lint (warnings only), 12/12 boundary tests and production
  build pass locally.
- Exact next step: publish the coordinated frontend PR after the backend PR and
  wait for CI before requesting merge authorization.

### 2026-09-09 — Phase 5 start: truthful Family status

- Removed the hard-coded Family greeting name and the unsupported claim that
  the recipient “está bien hoy”.
- Family Today now identifies the real authorized recipient without asserting
  a wellbeing status.
- A wellbeing/care update appears only from the real family-safe timeline; when
  none exists, the screen says there are no updates today.
- No backend change is required. Exact next step: validate and publish this
  isolated Phase 5 correction.

### 2026-09-09 — Administration Workers real-data migration

- Removed the final operational `DemoStore` import from Administration.
- The caregiver list now loads organization memberships and each real worker
  profile, including credential type, status and expiration.
- Replaced unsupported mock availability with the actual membership state.
- Added visible expired and 30-day expiration warnings, plus loading, empty,
  error and retry states.
- Existing backend contracts cover the scope; no backend change is required.
- Exact next step: validate, commit, publish and integrate the frontend PR.

### 2026-09-09 — Family History real-data migration

- Removed the fixed Carmen demo identity and all `DemoStore` reads from Family
  History.
- The screen now resolves the authenticated Family recipient, loads completed
  family-safe shifts and uses the curated timeline for each shift detail.
- Existing V23 list/detail layout is preserved with loading, empty and visible
  API error states.
- No backend change is required. Exact next step: validate, commit and create a
  draft frontend PR; do not merge without explicit authorization.

### 2026-09-09 — Incident details and real resident profile

- Family and Agency incident notifications now open role-appropriate detail
  routes instead of only changing read state.
- Family detail uses only the curated `family-incidents` contract and never
  receives internal actions, assignment or resolution fields.
- Agency incident cards open the full operational detail, including reporter,
  immediate actions, status, resolution when present and follow-up timeline.
- Agency incident detail links directly to the associated resident.
- Agency resident rows open a real profile with demographics, care information,
  shift/caregiver, open incidents and recent care events.
- No backend change was required; existing protected contracts cover the scope.
- Production remains unchanged. Exact next step: finish validation, commit and
  create a draft frontend PR without merging.

### 2026-09-08 — Real incidents and notifications correction

- Branch: `fix/v23-real-incidents-notifications` from deployed frontend commit
  `38be84a807e72ec8bbf2fbf730c7c85d4eff62de`.
- Administration Incidents now lists organization-scoped backend incidents and
  resolves recipient names from the real recipient endpoint.
- Notification bells in Family, Caregiver and Agency now load the authenticated
  user's `/me/notifications` inbox, refresh when opened/focused and poll every
  30 seconds.
- Family Notifications now renders real items and supports one/all read actions.
- Removed the fake fixed Admin incident badge and the caregiver success message
  that claimed delivery before another portal had loaded it.
- Backend required no code change: incident creation and recipient notification
  insertion already occur in the same transaction.
- Validation passed: typecheck, 5/5 boundary tests, lint (warnings only),
  production build; backend regression 15/15 passed.
- Production remains unchanged. Exact next step: review diff, commit and create
  a frontend PR; do not merge without explicit authorization.

### 2026-09-08 — Validation findings: shifts, incidents and credentials

- Family Today now uses the curated family shift and timeline contracts; the
  assigned caregiver and check-in/out state no longer come from DemoStore.
- Caregiver shift detail includes a real incident form backed by the existing
  incident endpoint.
- Caregiver Profile loads the authenticated worker's credential summaries and
  highlights pending, expiring and expired items.
- Family Profile and Today show only the assigned caregiver's verified,
  family-safe credential summaries; no documents or internal review fields.
- Requires the coordinated backend branch `feature/shift-incidents-credentials`.
- Frontend typecheck, lint, 4/4 boundary tests and production build pass.
- Production remains unchanged. Exact next step: commit, then
  request authorization to publish coordinated backend/frontend PRs.

### 2026-09-08 — Phase 4.5 first consolidation cut

- Restore point created at `restore/phase4-stable-2026-09-08` from main commit
  `73bc3697391b6cba94cc718995d4cd7ca32417e3`.
- Extracted the exact deployed V23 artifact into tracked source at
  `frontend-v23/`; visual source is unchanged.
- CI and Pages deployment now validate/build that same directory.
- Removed `continue-on-error`; typecheck, lint, boundary tests, and build are
  blocking in both PR validation and deployment.
- Added `docs/FRONTEND_DATA_AUDIT.md` with real/simulated/mixed classification.
- Backend `main` was inspected at `46002664806854defe2576e3633de317fcddfcbb`;
  no backend changes were made.
- Frontend validation passed: typecheck, lint (warnings only), 3/3 boundary
  tests, and production build.
- Backend read-only regression passed: TypeScript build and 11/11 tests.

### Exact next task after this cut

- Review this PR, then migrate Family Today and Family History from DemoStore
  to the family-safe recipient timeline/shift contracts without changing V23.

### 2026-09-07 — Emergency visual restoration

- GitHub Pages had switched from the prior V23 experience to the incomplete
  `frontend/` interface when PR #6 changed the deployment artifact.
- The deployment workflow is being restored to build `frontend-v23.zip`.
- The deployed V23 build now targets the active Railway backend (`d460`).
- The real-data `frontend/` implementation remains in the repository and is
  not deleted or reverted.
- Important: V23 still contains DemoStore-backed feature screens. Restore is
  for visual continuity only; those screens must not be represented as
  backend-persisted data.

### Exact next task after restoration

- Port the verified real API flows from `frontend/` into the V23 visual shell,
  beginning with messaging and the Family care summary, without mock fallback.

### 2026-09-07 — V23 real messaging integration

- Branch: `fix/v23-real-messaging`
- Replaced DemoStore messaging in Caregiver, Family, and Agency with the real
  Railway messaging endpoints.
- Preserved the V23 layouts, routes, navigation, and visual components.
- Messages are loaded from and written to the authenticated user's authorized
  backend conversation; no local/mock fallback remains in messaging.
- Local TypeScript and production build pass.
- Pending: PR review, merge, GitHub Pages deployment, and three-role live test.

### 2026-09-07 — V23 real shifts integration

- Branch: `fix/v23-real-shifts`
- Administration now loads real recipients, workers, shifts, and assignments.
- Administration can create a shift and assign an active worker through the
  existing scheduling and assignment endpoints.
- Caregiver now loads only the authenticated worker's real assignments through
  `GET /organizations/:organizationId/me/shifts`.
- Caregiver shift detail uses real visit verification for start/check-in and
  finish/check-out; no DemoStore fallback remains in these three shift screens.
- Mock care-event entry was removed from the real shift detail rather than
  pretending those records persist. Care events remain a separate task.
- Local TypeScript production build and lint pass (warnings only).
- Pending: backend demo eligibility seed PR, frontend PR, merges, deployment,
  and live Admin → María start/finish validation.

### Completed
- Frontend AGENTS.md created

### Files Changed
- AGENTS.md
- docs/AGENT_STATE.md

### Tests Run
- Phase 4.5 frontend: typecheck, lint, 3 boundary tests, production build
- Backend contract regression: build and 11 tests

### Failures / Risks
- Real/mock data boundaries still need audit

### Uncommitted Work
- To be determined

### Exact Next Step
- Review the coordinated backend eligibility and frontend V23 shifts PRs, merge
  backend first, verify Railway, then merge frontend and validate Admin → María.
