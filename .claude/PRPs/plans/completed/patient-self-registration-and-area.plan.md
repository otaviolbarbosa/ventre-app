# Feature: Patient Self-Registration and Patient Area

## Summary

Give pregnant patients (gestantes) direct access to the platform through an invite-only self-registration flow, and a new patient-facing area with four sections: prenatal card (read), agenda (read + confirm attendance), billing (read + register payment), and a tools placeholder (contraction timer, heart-rate counter — implementation deferred). A patient never registers unsolicited: a professional or staff member generates an invite link from `new-patient-modal.tsx` ("Solicitar auto cadastro" checkbox), which the patient completes via a new public route `/patient-registration?piid=<id>`, using either email/password or Google OAuth. The flow mirrors the existing professional invite flow (`registration_invites` → `/complete-registration`) almost exactly, extending the already-half-built (but unused) `patient_invite_links` table instead of creating a parallel one.

## User Story

As a gestante invited by my prenatal care team,
I want to create my own account and see my prenatal card, agenda, and billing without asking staff for updates,
So that I can confirm appointments, track what I owe, and self-serve payment registration.

## Problem Statement

Patients have no self-service access today. RLS already grants patients read access to their own `patients`, `billing`, `installments`, and `patient_documents` rows (via `patients.user_id = auth.uid()`), but no UI, no invite mechanism, and no route exists to let them log in as a `patient`-type user in the first place — the signup trigger even hardcodes every new user as `'professional'`.

## Solution Statement

Extend `patient_invite_links` with `invite_type`, `enterprise_id`, `name`/`email`/`phone` prefill, and a `metadata` jsonb blob that carries team/billing decisions made at invite time. Add a "Solicitar auto cadastro" checkbox to `new-patient-modal.tsx` that, when checked, disables the Gestante/Endereço steps (patient fills those herself) and creates an invite row instead of a patient row. Build a public `/patient-registration` route mirroring `/complete-registration` exactly, extract the patient/team/billing creation logic from `add-patient-action.ts` into a shared helper so both the direct-creation and invite-completion paths use it, fix `handle_new_user` to respect `user_type` metadata, add a `confirmed_by_patient_at` column + RLS read policy for `appointments`, add an `em_analise` installment status for patient-submitted payments pending professional confirmation, and build the `app/(patient)/...` route group with the four sections.

## Metadata

| Field | Value |
|---|---|
| Type | NEW_CAPABILITY |
| Complexity | HIGH |
| Systems Affected | Database (Supabase migrations + RLS), auth (signup trigger, OAuth callback), server actions, public routing, new patient-facing route group, email (Resend) |
| Dependencies | `next-safe-action`, `@supabase/ssr`, `resend`, `react-hook-form`, `zod` — all already in use, no new packages |
| Estimated Tasks | 34 |

---

## UX Design

### Before State

```
╔═══════════════════════════════════════════════════════════════════════════╗
║                              BEFORE STATE                                  ║
╠═══════════════════════════════════════════════════════════════════════════╣
║                                                                           ║
║  new-patient-modal.tsx (professional/staff only)                        ║
║   Step1 Gestante → Step2 Contato → Step3 Endereço → Step4 Equipe/Empresa ║
║   → Step5 Cobrança → addPatientAction → patients+team_members+billing   ║
║                                                                           ║
║  Gestante: NO login, NO account, NO visibility into her own data.       ║
║  Any auth.users signup → handle_new_user → ALWAYS user_type='professional║
║                                                                           ║
║  /home → assumes professional/staff → gestante would hit /onboarding    ║
║          incorrectly if she ever got an account                         ║
║                                                                           ║
╚═══════════════════════════════════════════════════════════════════════════╝
```

### After State

```
╔═══════════════════════════════════════════════════════════════════════════╗
║                               AFTER STATE                                  ║
╠═══════════════════════════════════════════════════════════════════════════╣
║                                                                           ║
║  new-patient-modal.tsx                                                  ║
║   [x] Solicitar auto cadastro  →  Step1,3 disabled, Step2 still active  ║
║   Step4 Equipe/Empresa + Step5 Cobrança → createPatientInviteAction     ║
║   → patient_invite_links (invite_type='new_patient', metadata jsonb)   ║
║   → "Copiar link" / E-mail / WhatsApp share (mirrors invite-professional║
║     -modal.tsx exactly)                                                 ║
║                                                                           ║
║  Gestante clicks link → /patient-registration?piid=<id>                 ║
║   → validates expires_at/used_at (admin client, same pattern as         ║
║     /complete-registration)                                             ║
║   → PatientRegisterScreen: senha (ou Google) → dados+avatar → confirma  ║
║   → completePatientRegistrationAction (public actionClient)             ║
║   → creates patients+team_members+billing (shared helper) OR links      ║
║     existing patient (type 2), sets patients.user_id, marks invite used ║
║                                                                           ║
║  handle_new_user reads raw_user_meta_data.user_type (fallback           ║
║  'professional') → correctly creates user_type='patient' row            ║
║                                                                           ║
║  /home → branches on user_type==='patient' → app/(patient)/home         ║
║                                                                           ║
║  app/(patient)/ (new protected route group)                             ║
║   ├── Cartão pré-natal (read, reuses prenatal-card.tsx read parts)      ║
║   ├── Agenda (read + "Confirmar presença" → confirmAppointmentAttendance║
║   │    Action, new RLS + confirmed_by_patient_at column)                ║
║   ├── Financeiro (read + "Registrar pagamento" → registerInstallment    ║
║   │    PaymentAction → status='em_analise' until professional confirms  ║
║   │    via new confirmInstallmentPaymentAction)                         ║
║   └── Ferramentas (2 disabled "em breve" cards)                         ║
║                                                                           ║
╚═══════════════════════════════════════════════════════════════════════════╝
```

### Interaction Changes

| Location | Before | After | User Impact |
|---|---|---|---|
| `new-patient-modal.tsx` | Always creates patient immediately | Checkbox creates invite instead, steps 1/3 disabled | Staff/professional can request self-registration |
| `/patient-registration?piid=` | Does not exist | Public route, invite-gated signup | Gestante can create her own account |
| `app/auth/callback/route.ts` | Only `intent=google_calendar` side effect | New `intent=patient_invite` side effect | Google signup works for patients too |
| `/home` | Assumes professional/staff, patient falls into `/onboarding` | Branches to `app/(patient)/home` for `user_type==='patient'` | Gestante lands in her own area |
| `appointments` | No patient self-read, no confirm-attendance | RLS read + `confirmed_by_patient_at` + action | Gestante sees and confirms her appointments |
| `installments` | Mutations service_role-only, no patient path | New action grants `'em_analise'` write path | Gestante can register a payment, pending confirmation |
| Patient's ficha (professional side) | No way to invite an already-existing patient | New "Convidar Gestante" button (type 2 invite) | Staff can link an existing patient record to a new login |

---

## Mandatory Reading

**CRITICAL: Read these files before starting any task.**

| Priority | File | Lines | Why Read This |
|---|---|---|---|
| P0 | `apps/web/src/actions/complete-registration-action.ts` | all | Exact pattern to MIRROR for `completePatientRegistrationAction` |
| P0 | `apps/web/app/complete-registration/page.tsx` | all | Server Component pattern to MIRROR for `/patient-registration` |
| P0 | `apps/web/src/screens/complete-registration-screen.tsx` | all | 3-step form (password → data+avatar → confirm) to MIRROR |
| P0 | `packages/supabase/supabase/migrations/20260410000001_registration_invites.sql` | all | Table shape to reference when extending `patient_invite_links` |
| P0 | `packages/supabase/supabase/migrations/20260126012100_remote_schema.sql` | 142-150, 292-334 | Current `patient_invite_links` + `appointments`/`patients` RLS to ALTER |
| P0 | `packages/supabase/supabase/migrations/20260126123930_migration.sql` | 2-42 | `handle_new_user` trigger — MUST fix hardcoded `user_type` |
| P0 | `apps/web/src/actions/add-patient-action.ts` | all | Logic to EXTRACT into shared helper |
| P0 | `apps/web/src/services/patient.ts` | 173-268 | `createPatient` — core to be reused by the shared helper |
| P0 | `apps/web/src/services/billing.ts` | 309-407 | `createBilling` — reused by the shared helper |
| P1 | `apps/web/src/modals/new-patient-modal.tsx` | full | Wizard structure, `STEP_FIELDS`, step4 Equipe/Empresa branching, billing split logic — MIRROR for invite mode |
| P1 | `apps/web/src/modals/invite-professional-modal.tsx` | 112-143 | Copy-link/email/WhatsApp share pattern to MIRROR |
| P1 | `apps/web/app/auth/callback/route.ts` | all | `intent=google_calendar` block — MIRROR for `intent=patient_invite` |
| P1 | `apps/web/src/providers/auth-provider.tsx` | 126-153 | `signInWithGoogle`/`connectGoogleCalendar` — pattern for passing `intent` |
| P1 | `apps/web/src/lib/safe-action.ts` | all | `actionClient` (public) vs `authActionClient` — no admin client exists, follow this exactly |
| P1 | `apps/web/src/lib/validations/patient.ts` | all | `createPatientSchema` — base for `patientSelfRegistrationSchema` |
| P1 | `apps/web/src/lib/validations/billing.ts` | 15-65 | `createBillingSchema` shape stored in invite `metadata` |
| P1 | `apps/web/src/actions/save-installment-link-action.ts` | all | `authActionClient` + `supabaseAdmin` mutation pattern to MIRROR for payment actions |
| P1 | `apps/web/proxy.ts` | all | `publicRoutes` — add `/patient-registration`, remove unused `/register/patient` |
| P1 | `apps/web/app/(dashboard)/home/page.tsx` | all | Post-login routing — ADD patient branch |
| P1 | `apps/web/src/lib/server-auth.ts` | all | `getServerAuth()` contract — reuse in every new patient-area page |
| P2 | `apps/web/src/services/appointment.ts` | 27-53 | `getMyAppointments` — pattern for new `getMyPatientAppointments` |
| P2 | `apps/web/src/components/shared/prenatal-card.tsx` | all | Read-only reuse candidate — identify which parts are edit-only to gate out |
| P2 | `apps/web/app/api/profile/avatar/route.ts` | all | Avatar upload endpoint reused post-auth |
| P2 | `apps/web/src/lib/emails/send-professional-invite.ts` | all | Resend template to MIRROR for patient invite email |
| P2 | `apps/web/src/actions/lookup-cep-action.ts` | all | CEP lookup action reused in the self-registration address step |

---

## Patterns to Mirror

**INVITE EXPIRY/USED VALIDATION** (mirror in `patient-registration/page.tsx` and `completePatientRegistrationAction`):
```typescript
// SOURCE: apps/web/src/actions/complete-registration-action.ts:29-39
if (inviteError || !invite) throw new Error("Convite não encontrado.");
if (invite.completed_at) throw new Error("Convite já utilizado.");
if (new Date(invite.expired_at) < new Date()) throw new Error("Convite expirado.");
```

**PUBLIC ACTION FOR PRE-AUTH SIGNUP:**
```typescript
// SOURCE: apps/web/src/actions/complete-registration-action.ts:15,46-52
export const completeRegistrationAction = actionClient
  .schema(completeRegistrationSchema)
  .action(async ({ parsedInput }) => {
    const supabaseAdmin = await createServerSupabaseAdmin();
    // ...
    const { data: signUpData, error: signUpError } = await supabaseAdmin.auth.signUp({
      email: finalEmail,
      password,
      options: { data: { name: finalName, professional_type: invite.professional_type } },
    });
  });
```

**COPY LINK / WHATSAPP / EMAIL SHARE:**
```typescript
// SOURCE: apps/web/src/modals/invite-professional-modal.tsx:132-143
async function handleShareWhatsApp() {
  const result = await executeInviteLink({ patientId: patient.id });
  if (!result?.data?.invite) { toast.error(...); return; }
  const inviteUrl = getInviteUrl();
  const message = `Olá! Estou te convidando... Acesse o link: ${inviteUrl}/${result.data.invite.id}`;
  window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank");
}
```

**OAUTH INTENT SIDE-EFFECT (mirror for `intent=patient_invite`):**
```typescript
// SOURCE: apps/web/app/auth/callback/route.ts:45-60
if (intent === "google_calendar" && data.session?.provider_token) {
  const admin = await createServerSupabaseAdmin();
  try {
    await admin.from("user_google_tokens").upsert({
      user_id: data.session.user.id,
      access_token: data.session.provider_token,
      refresh_token: data.session.provider_refresh_token ?? undefined,
      expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
    }, { onConflict: "user_id" });
  } catch (err) {
    console.error(err);
  }
}
```

**AUTHACTIONCLIENT + ADMIN MUTATION WITH OWNERSHIP CHECK (mirror for patient payment/attendance actions, but ADD an explicit `patients.user_id = auth.uid()` check that `save-installment-link-action.ts` does NOT do today — see Gotcha below):**
```typescript
// SOURCE: apps/web/src/actions/save-installment-link-action.ts:16-28
const { data: installment } = await supabaseAdmin
  .from("installments")
  .select("*")
  .eq("id", installmentId)
  .eq("billing_id", billingId)
  .single();
if (!installment) throw new Error("Parcela não encontrada");
await supabaseAdmin.from("installments").update({ payment_link: parsedInput.paymentLink || null }).eq("id", parsedInput.installmentId);
```

**ROLLBACK-ON-FAILURE PATTERN (mirror in the extracted shared helper):**
```typescript
// SOURCE: apps/web/src/services/patient.ts:202-238
const { data: patient, error: patientError } = await supabaseAdmin.from("patients").insert(insertData).select().single();
if (patientError) throw new Error(patientError.message);
const { data: pregnancy, error: pregnancyError } = await supabaseAdmin.from("pregnancies").insert({...}).select("id").single();
if (pregnancyError) {
  await supabaseAdmin.from("patients").delete().eq("id", patient.id);
  throw new Error(pregnancyError.message);
}
```

**DUM AUTO-CALC FROM DPP:**
```typescript
// SOURCE: apps/web/src/modals/new-patient-modal.tsx:560-569
onChange={(date) => {
  field.onChange(date ? date.toISOString().slice(0, 10) : "");
  if (date) {
    form.setValue("dum", dayjs(date).subtract(280, "day").format("YYYY-MM-DD"));
  } else {
    form.setValue("dum", "");
  }
}}
```

**CEP AUTO-LOOKUP:**
```typescript
// SOURCE: apps/web/src/modals/new-patient-modal.tsx:677-686
onChange={(e) => {
  field.onChange(e);
  const digits = e.target.value.replace(/\D/g, "");
  if (digits.length === 8) lookupCep({ cep: digits });
  if (digits.length < 8) setAddressVisible(false);
}}
```

**STEP4 EQUIPE VS EMPRESA BRANCH (mirror, but force "Equipe" always for staff in invite mode per resolved decision):**
```typescript
// SOURCE: apps/web/src/modals/new-patient-modal.tsx:204-206
const showProfessionalSelector = professionalsOptions.length > 0;
const showEnterpriseSelector = enterprises !== undefined && !showProfessionalSelector;
const step4Label = showEnterpriseSelector ? "Empresa" : "Equipe";
```

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `packages/supabase/supabase/migrations/{ts}_patient_invite_links_extend.sql` | CREATE | Extend `patient_invite_links`: invite_type, enterprise_id, name/email/phone, metadata, drop token, INSERT/UPDATE policy changes |
| `packages/supabase/supabase/migrations/{ts}_handle_new_user_patient_type.sql` | CREATE | Fix `handle_new_user` to read `user_type` from metadata |
| `packages/supabase/supabase/migrations/{ts}_appointments_patient_rls_and_confirm.sql` | CREATE | Add `confirmed_by_patient_at` column + patient-self SELECT policy on `appointments` |
| `packages/supabase/supabase/migrations/{ts}_installment_status_em_analise.sql` | CREATE | `ALTER TYPE installment_status ADD VALUE 'em_analise'` |
| `packages/supabase/src/types/database.types.ts` | UPDATE | Regenerated via `pnpm db:types` after each migration |
| `apps/web/src/lib/validations/patient-invite.ts` | CREATE | Zod schemas: `createPatientInviteSchema`, `patientSelfRegistrationSchema`, `linkExistingPatientRegistrationSchema` |
| `apps/web/src/services/patient-onboarding.ts` | CREATE | Extracted shared helper: `createPatientWithTeamAndBilling(...)`, reused by `add-patient-action.ts` and the invite-completion action |
| `apps/web/src/actions/add-patient-action.ts` | UPDATE | Delegate to the new shared helper instead of inline `createPatient`/`createBilling` calls |
| `apps/web/src/actions/create-patient-invite-action.ts` | CREATE | `authActionClient` action creating a `new_patient` invite row from the modal |
| `apps/web/src/actions/send-patient-invite-email-action.ts` | CREATE | `authActionClient` action sending the invite email via Resend |
| `apps/web/src/actions/complete-patient-registration-action.ts` | CREATE | Public `actionClient` action finalizing signup (type 1 and type 2), mirrors `complete-registration-action.ts` |
| `apps/web/src/actions/confirm-appointment-attendance-action.ts` | CREATE | `authActionClient` action, patient-only, sets `confirmed_by_patient_at` |
| `apps/web/src/actions/register-installment-payment-action.ts` | CREATE | `authActionClient` action, patient-only, sets `installments.status = 'em_analise'` |
| `apps/web/src/actions/confirm-installment-payment-action.ts` | CREATE | `authActionClient` action, professional-only, confirms/rejects an `em_analise` installment |
| `apps/web/src/actions/create-link-existing-patient-invite-action.ts` | CREATE | `authActionClient` action creating a `link_existing` invite from the patient's ficha |
| `apps/web/src/lib/emails/send-patient-invite.ts` | CREATE | Resend template, mirrors `send-professional-invite.ts` |
| `apps/web/src/modals/new-patient-modal.tsx` | UPDATE | Add "Solicitar auto cadastro" checkbox, disable Steps 1/3 in invite mode, branch submit to `createPatientInviteAction` |
| `apps/web/src/modals/patient-invite-share-modal.tsx` | CREATE | Copy-link/e-mail/WhatsApp share UI, mirrors `invite-professional-modal.tsx` |
| `apps/web/src/modals/invite-existing-patient-modal.tsx` | CREATE | Type-2 invite trigger from the patient's ficha, mirrors `invite-professional-modal.tsx` structurally |
| `apps/web/app/patient-registration/page.tsx` | CREATE | Server Component: fetch+validate invite via admin client, render screen or error redirect |
| `apps/web/src/screens/patient-register-screen.tsx` | CREATE | Client 3-step form (password/Google → dados+avatar → confirmação), mirrors `complete-registration-screen.tsx` |
| `apps/web/app/auth/callback/route.ts` | UPDATE | Add `intent === "patient_invite"` branch |
| `apps/web/src/providers/auth-provider.tsx` | UPDATE | Allow `signInWithGoogle` to accept an `intent` param for the patient-invite flow |
| `apps/web/proxy.ts` | UPDATE | Add `/patient-registration` to `publicRoutes`, remove unused `/register/patient` |
| `apps/web/app/(dashboard)/home/page.tsx` | UPDATE | Add `user_type === "patient"` branch redirecting to `/patient-home` (or equivalent) |
| `apps/web/app/(patient)/layout.tsx` | CREATE | Patient-area layout, simple nav, `getServerAuth()` guard for `user_type === "patient"` |
| `apps/web/app/(patient)/home/page.tsx` | CREATE | Patient area entry: prenatal card summary + nav to other sections |
| `apps/web/app/(patient)/agenda/page.tsx` | CREATE | Patient's appointments list + "Confirmar presença" |
| `apps/web/app/(patient)/financeiro/page.tsx` | CREATE | Patient's billings/installments + "Registrar pagamento" |
| `apps/web/app/(patient)/ferramentas/page.tsx` | CREATE | Two "em breve" placeholder cards |
| `apps/web/src/services/patient-self.ts` | CREATE | Patient-self read queries: `getMyPregnancy`, `getMyPatientAppointments`, `getMyBillingSummary` (all filtering by `patients.user_id = auth.uid()`) |
| `apps/web/src/components/patient-area/prenatal-card-readonly.tsx` | CREATE | Read-only extraction from `prenatal-card.tsx`, no edit/delete affordances |
| `apps/web/src/components/patient-area/appointment-list.tsx` | CREATE | Patient-facing appointment list with confirm button |
| `apps/web/src/components/patient-area/billing-summary.tsx` | CREATE | Patient-facing billing/installments list with register-payment action |
| `apps/web/src/screens/patient-payment-confirmation-screen.tsx` (or existing billing screen) | UPDATE | Add professional-side UI to confirm/reject `em_analise` installments |

---

## NOT Building (Scope Limits)

- Real implementation of the contraction timer / heart-rate counter tools — placeholder cards only ("em breve").
- Patient self-editing of profile/gestational data beyond what self-registration collects.
- Push notifications specific to the patient area (pipeline already supports `patients.user_id`; only UI consumption is deferred).
- PWA/mobile-specific patient experience.
- Notifying the professional when a patient confirms attendance (per resolved decision — timestamp write only).

---

## Step-by-Step Tasks

Execute in dependency order. Each task is independently verifiable.

### Database (Tasks 1–5)

**Task 1: CREATE migration `packages/supabase/supabase/migrations/{ts}_patient_invite_links_extend.sql`**
- **ACTION**: Extend `patient_invite_links`
- **IMPLEMENT**:
  ```sql
  ALTER TABLE public.patient_invite_links
    ADD COLUMN invite_type   text NOT NULL DEFAULT 'link_existing'
      CHECK (invite_type IN ('new_patient', 'link_existing')),
    ADD COLUMN enterprise_id uuid REFERENCES public.enterprises(id) ON DELETE CASCADE,
    ADD COLUMN name          text,
    ADD COLUMN email         text,
    ADD COLUMN phone         text,
    ADD COLUMN metadata      jsonb NOT NULL DEFAULT '{}'::jsonb,
    ADD CONSTRAINT patient_invite_links_link_existing_requires_patient
      CHECK (invite_type = 'new_patient' OR patient_id IS NOT NULL);

  ALTER TABLE public.patient_invite_links DROP CONSTRAINT patient_invite_links_token_key;
  ALTER TABLE public.patient_invite_links DROP COLUMN token;

  DROP POLICY "Create invite links" ON public.patient_invite_links;
  CREATE POLICY "Create invite links" ON public.patient_invite_links
    FOR INSERT WITH CHECK (
      (invite_type = 'link_existing' AND public.is_team_member(patient_id))
      OR (invite_type = 'new_patient' AND patient_id IS NULL AND created_by = auth.uid())
    );

  DROP POLICY "Update invite links" ON public.patient_invite_links;
  CREATE POLICY "Update invite links" ON public.patient_invite_links
    FOR UPDATE TO service_role USING (true) WITH CHECK (true);
  ```
- **MIRROR**: `packages/supabase/supabase/migrations/20260213000001_billing_module.sql` for ALTER TABLE + policy style
- **GOTCHA**: `expires_at` default must be added too — original table def (`remote_schema.sql:142-150`) requires it `NOT NULL`; confirm existing rows have no default before this migration (table is unused in app code, safe to assume empty per exploration findings) — set `ALTER COLUMN expires_at SET DEFAULT (now() + interval '7 days')`
- **VALIDATE**: `pnpm db:push` succeeds; `mcp__supabase__list_tables` shows updated columns

**Task 2: CREATE migration `packages/supabase/supabase/migrations/{ts}_handle_new_user_patient_type.sql`**
- **ACTION**: Fix `handle_new_user` trigger to respect `user_type` metadata
- **IMPLEMENT**: Read `NEW.raw_user_meta_data->>'user_type'`; if it equals `'patient'`, insert with `user_type = 'patient'::public.user_type` and `professional_type = NULL`; otherwise preserve exact existing logic (fallback `'professional'`)
- **MIRROR**: `packages/supabase/supabase/migrations/20260126123930_migration.sql:2-42` — `CREATE OR REPLACE FUNCTION public.handle_new_user()` with same signature/trigger binding
- **GOTCHA**: Must not break the existing professional/staff signup path — the safest change is a single `IF NEW.raw_user_meta_data->>'user_type' = 'patient' THEN ... ELSE <existing logic> END IF;` wrapping the whole body, not a partial patch
- **VALIDATE**: `pnpm db:push`; manually verify via `mcp__supabase__execute_sql` that a test insert into `auth.users` with `raw_user_meta_data = '{"user_type":"patient","name":"Test"}'` produces `user_type='patient'` in `public.users` (then delete the test row)

**Task 3: CREATE migration `packages/supabase/supabase/migrations/{ts}_appointments_patient_rls_and_confirm.sql`**
- **ACTION**: Add patient-self read access + confirm-attendance column to `appointments`
- **IMPLEMENT**:
  ```sql
  ALTER TABLE public.appointments ADD COLUMN confirmed_by_patient_at timestamptz;

  DROP POLICY "View appointments" ON public.appointments;
  CREATE POLICY "View appointments" ON public.appointments FOR SELECT USING (
    public.is_team_member(patient_id)
    OR professional_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.patients WHERE patients.id = appointments.patient_id AND patients.user_id = auth.uid())
  );
  ```
- **MIRROR**: `packages/supabase/supabase/migrations/20260213000001_billing_module.sql:71-81` (billings patient-self clause) for the `EXISTS` subquery shape
- **GOTCHA**: Do NOT touch the enterprise-staff supplemental policies in `20260528000001_remove_users_enterprise_id.sql:113-177` — this migration only adds the patient-self OR-clause to the base `"View appointments"` policy; leave UPDATE/DELETE/INSERT policies untouched since the confirm-attendance write goes through a dedicated action with the admin client, not a patient-facing UPDATE RLS grant
- **VALIDATE**: `pnpm db:push`; `mcp__supabase__get_advisors` shows no new RLS warnings

**Task 4: CREATE migration `packages/supabase/supabase/migrations/{ts}_installment_status_em_analise.sql`**
- **ACTION**: Add enum value for pending-confirmation payments
- **IMPLEMENT**: `ALTER TYPE public.installment_status ADD VALUE IF NOT EXISTS 'em_analise';`
- **GOTCHA**: Postgres requires `ALTER TYPE ... ADD VALUE` to run in its own transaction/migration — cannot be combined with a migration that uses the new value in the same statement batch; keep this as a standalone file
- **VALIDATE**: `pnpm db:push`; `mcp__supabase__execute_sql` with `SELECT unnest(enum_range(NULL::installment_status));` shows `em_analise`

**Task 5: Regenerate types**
- **ACTION**: `pnpm db:types`
- **VALIDATE**: `git diff packages/supabase/src/types/database.types.ts` shows `patient_invite_links`, `appointments.confirmed_by_patient_at`, `installment_status` enum updated; `pnpm check-types` passes

### Shared Helper Extraction (Tasks 6–7)

**Task 6: CREATE `apps/web/src/services/patient-onboarding.ts`**
- **ACTION**: Extract patient+team+billing creation into a reusable function
- **IMPLEMENT**: `createPatientWithTeamAndBilling(supabaseAdmin, supabase, userId, input: CreatePatientInput, enterpriseId: string | null): Promise<{ patient: Patient }>` — internally calls the same logic currently inline in `createPatient` (`services/patient.ts:173-268`) and `createBilling` (`services/billing.ts:309-407`), preserving the exact rollback-on-failure behavior
- **MIRROR**: `apps/web/src/services/patient.ts:173-268`, `apps/web/src/services/billing.ts:309-407` — copy behavior verbatim, do not alter existing rollback semantics
- **GOTCHA**: `createBilling`'s `billings` INSERT uses the anon `supabase` client (RLS-respecting) while `installments` INSERT uses `supabaseAdmin` (per analyst trace) — preserve this split exactly; the invite-completion caller must pass a `supabase` client bound to the *newly created* patient user's session (post `signInWithPassword`), not the admin client, or RLS will reject the `billings` insert
- **VALIDATE**: `pnpm check-types`

**Task 7: UPDATE `apps/web/src/actions/add-patient-action.ts`**
- **ACTION**: Replace inline `createPatient`/`createBilling` calls with `createPatientWithTeamAndBilling`
- **IMPLEMENT**: No behavior change — same staff/professional branching (`:16-34`), same revalidation/activity-log side effects (`:58-74`)
- **VALIDATE**: `pnpm check-types`; manually create a patient via the existing modal in dev and confirm no regression (Level 6 manual check)

### Invite Creation — Type 1 (Tasks 8–13)

**Task 8: CREATE `apps/web/src/lib/validations/patient-invite.ts`**
- **ACTION**: Zod schemas for invite creation and self-registration
- **IMPLEMENT**: `createPatientInviteSchema` (subset of `createPatientSchema` — omits Gestante/Endereço fields, keeps `name`/`email`/`phone`/`professional_ids`/`backup_professional_ids`/`enterprise_id`/`billing`); `patientSelfRegistrationSchema` (password + full Gestante/Endereço fields for type 1); `linkExistingPatientRegistrationSchema` (password + confirm contact fields for type 2)
- **MIRROR**: `apps/web/src/lib/validations/patient.ts:4-35`
- **VALIDATE**: `pnpm check-types`

**Task 9: UPDATE `apps/web/src/modals/new-patient-modal.tsx`**
- **ACTION**: Add "Solicitar auto cadastro" checkbox and invite-mode branching
- **IMPLEMENT**: Checkbox above/near Step 1; when checked, `STEP_FIELDS` for Steps 1 and 3 stop being validated on `form.trigger()`/wizard advance (Step 2 unchanged); when staff (`isStaff(profile)`), force `step4Label = "Equipe"` always (never show Empresa) and pass a `professionals` list prop fetched for the staff's enterprise; when professional, keep existing Empresa step behavior but set `metadata.professional_ids = [inviterId]` implicitly (no Equipe step shown)
- **MIRROR**: existing `STEP_FIELDS`/`showProfessionalSelector`/`showEnterpriseSelector` logic (`:204-206`, `:381-385`)
- **IMPORTS**: `createPatientInviteAction` from new action file
- **GOTCHA**: Submit handler must branch — if checkbox checked, call `createPatientInviteAction` with `{ name: undefined, ...contactFields, professional_ids/backup_professional_ids or enterprise_id, billing }` instead of `addPatientAction`; on success, open `patient-invite-share-modal.tsx` instead of just closing
- **VALIDATE**: `pnpm check-types`; manual check in dev — toggling checkbox disables Steps 1/3 visually

**Task 10: Plumbing — pass `professionals` list to the modal for staff context**
- **ACTION**: Find where `new-patient-modal.tsx` is rendered for staff users and inject a `professionals` prop (enterprise's professional list)
- **IMPLEMENT**: Locate the parent screen(s) rendering the modal for staff (likely `patients` list screen); add a query for the enterprise's professionals (mirror however `enterprises` prop is currently fetched/passed) and pass as new `professionals` prop
- **VALIDATE**: `pnpm check-types`; manual check — staff sees Equipe selector populated with real professionals when checkbox is active

**Task 11: CREATE `apps/web/src/actions/create-patient-invite-action.ts`**
- **ACTION**: `authActionClient` action creating a `new_patient` invite row
- **IMPLEMENT**: Validate input against `createPatientInviteSchema`; if `isStaff(profile)`, require `enterprise_id = profile.enterprise_id` and verify `professional_ids` membership in `user_enterprises` (same check as `add-patient-action.ts:24-34`); if professional, set `metadata.professional_ids = [user.id]`; build `metadata` jsonb with `professional_ids`, `backup_professional_ids`, `billing`; `supabaseAdmin.from("patient_invite_links").insert({ invite_type: "new_patient", patient_id: null, created_by: user.id, enterprise_id, name, email, phone, metadata })`; return `{ invite }`
- **MIRROR**: `apps/web/src/actions/add-patient-action.ts:11-77` for the staff/professional branching and `supabaseAdmin` insert pattern
- **VALIDATE**: `pnpm check-types`

**Task 12: CREATE `apps/web/src/lib/emails/send-patient-invite.ts`**
- **ACTION**: Resend email template for patient self-registration invite
- **IMPLEMENT**: Same structure as professional invite email, subject/copy adapted to "Complete seu cadastro na Ventre", link to `/patient-registration?piid=<id>`
- **MIRROR**: `apps/web/src/lib/emails/send-professional-invite.ts` (full file, verbatim structure)
- **VALIDATE**: `pnpm check-types`; local preview if React Email dev server is configured

**Task 13: CREATE `apps/web/src/actions/send-patient-invite-email-action.ts` and `apps/web/src/modals/patient-invite-share-modal.tsx`**
- **ACTION**: Wire email send action + share modal (copy link / e-mail / WhatsApp)
- **IMPLEMENT**: Modal receives the created invite `id`, builds `inviteUrl = ${origin}/patient-registration?piid=${id}`, offers copy (`navigator.clipboard.writeText`), WhatsApp (`window.open(wa.me/?text=...)`), and "Enviar por e-mail" triggering the new action
- **MIRROR**: `apps/web/src/modals/invite-professional-modal.tsx:112-143` (all three share mechanisms)
- **VALIDATE**: `pnpm check-types`; manual dev check — all three share actions work

### Registration Route (Tasks 14–20)

**Task 14: UPDATE `apps/web/proxy.ts`**
- **ACTION**: Register `/patient-registration` as public, remove unused `/register/patient`
- **IMPLEMENT**: `publicRoutes` array edit — remove `"/register/patient"`, add `"/patient-registration"`
- **VALIDATE**: `pnpm check-types`

**Task 15: CREATE `apps/web/app/patient-registration/page.tsx`**
- **ACTION**: Server Component — validate invite via admin client, render screen or redirect
- **IMPLEMENT**: Read `piid` search param; if missing, `redirect("/login?error=missing_invite")`; `createServerSupabaseAdmin()` fetch by `id = piid`; validate `used_at IS NULL`, `expires_at > now()`; if invalid, `redirect("/login?error=invalid_invite")`; if `invite_type === "link_existing"`, also fetch the linked `patients` row and check `patients.user_id IS NULL` (else redirect "already used" per resolved decision #7); pass invite (+ linked patient data if type 2) to `PatientRegisterScreen`
- **MIRROR**: `apps/web/app/complete-registration/page.tsx` (full structure)
- **GOTCHA**: Confirm how `/login` currently renders `?error=` messages (check `FlashMessage`/login screen) before choosing the query param name — reuse the exact mechanism, do not invent a new one
- **VALIDATE**: `pnpm check-types`

**Task 16: CREATE `apps/web/src/screens/patient-register-screen.tsx`**
- **ACTION**: 3-step client form: senha (ou Google) → dados+avatar → confirmação
- **IMPLEMENT**: Step 1 password OR "Continuar com Google" button; Step 2 branches by `invite.invite_type` — type 1 shows full Gestante+Endereço+Contato(prefilled)+avatar fields (schema: `patientSelfRegistrationSchema`), type 2 shows only contact confirm+avatar (schema: `linkExistingPatientRegistrationSchema`); Step 3 confirmation summary; on submit calls `completePatientRegistrationAction`, then browser `supabase.auth.signInWithPassword`, then `POST /api/profile/avatar`, then `router.push("/home")`
- **MIRROR**: `apps/web/src/screens/complete-registration-screen.tsx` (full structure, all three steps, avatar upload sequencing)
- **IMPORTS**: `dayjs` DUM auto-calc, CEP lookup action — reuse exactly as in `new-patient-modal.tsx`
- **VALIDATE**: `pnpm check-types`

**Task 17: CREATE `apps/web/src/actions/complete-patient-registration-action.ts`**
- **ACTION**: Public `actionClient` action finalizing signup for both invite types
- **IMPLEMENT**: Validate invite (expiry/used, mirror Task 15 checks server-side too — defense in depth); `supabaseAdmin.auth.signUp({ email, password, options: { data: { name, user_type: "patient" } } })`; for type 1: call `createPatientWithTeamAndBilling` using invite's `metadata` (professional_ids, backup_professional_ids, billing) plus the form's Gestante/Endereço data, then `UPDATE patients SET user_id = signUpData.user.id`; for type 2: `UPDATE patients SET user_id = signUpData.user.id WHERE id = invite.patient_id` plus contact field updates; mark `patient_invite_links.used_at = now(), patient_id = <created or linked id>`
- **MIRROR**: `apps/web/src/actions/complete-registration-action.ts` (full flow structure, `options.data` metadata pattern, post-signup `UPDATE users` patch pattern)
- **GOTCHA**: `handle_new_user` (Task 2) must already be deployed and correctly reading `user_type` from metadata, or every patient signup will still be created as `'professional'`
- **VALIDATE**: `pnpm check-types`; end-to-end manual signup test (Level 6)

**Task 18: UPDATE `apps/web/src/providers/auth-provider.tsx`**
- **ACTION**: Allow `signInWithGoogle` to accept an `intent`/extra query param
- **IMPLEMENT**: Extend `signInWithGoogle(redirectTo?, intent?)` to append `&intent=patient_invite&piid=<id>` to the callback URL when provided, mirroring how `connectGoogleCalendar` already does it for `google_calendar`
- **MIRROR**: `apps/web/src/providers/auth-provider.tsx:136-153`
- **VALIDATE**: `pnpm check-types`

**Task 19: UPDATE `apps/web/app/auth/callback/route.ts`**
- **ACTION**: Add `intent === "patient_invite"` branch
- **IMPLEMENT**: After `exchangeCodeForSession`, if `intent === "patient_invite"` and a `piid` query param is present: `createServerSupabaseAdmin()`, `UPDATE public.users SET user_type = 'patient' WHERE id = data.session.user.id`, then redirect to `/patient-registration/complete?piid=<piid>` (a lightweight follow-up step to collect DPP/address/avatar, per resolved decision — NOT the full `/patient-registration` page again, since auth already happened)
- **MIRROR**: `apps/web/app/auth/callback/route.ts:45-60` (the `intent === "google_calendar"` block) for the try/catch-and-log-only error handling shape
- **GOTCHA**: This creates a new sub-route `/patient-registration/complete` needing its own page + form (collects remaining data post-OAuth) — scope this as Task 20; do not try to reuse `patient-register-screen.tsx`'s Step 1 (password) since OAuth already authenticated the user
- **VALIDATE**: `pnpm check-types`

**Task 20: CREATE `apps/web/app/patient-registration/complete/page.tsx` + companion client component**
- **ACTION**: Post-OAuth "complete your data" step for patients who signed up via Google
- **IMPLEMENT**: Authenticated page (uses `getServerAuth()`, redirects to `/login` if unauthenticated); reads `piid` search param, fetches the same invite row; renders Step 2+3 of `patient-register-screen.tsx` reused as a shared sub-component (extract Steps 2/3 into `patient-register-data-step.tsx` + `patient-register-confirm-step.tsx` so both the password flow and the OAuth flow share them); on submit calls a variant of `completePatientRegistrationAction` that skips the `auth.signUp` call (user already exists) and only does patient/team/billing creation + invite finalization
- **MIRROR**: `apps/web/src/screens/complete-registration-screen.tsx` Step 2 (data+avatar)
- **VALIDATE**: `pnpm check-types`; manual Google OAuth signup test (Level 6)

### Patient Area — Routing & Sections (Tasks 21–30)

**Task 21: UPDATE `apps/web/app/(dashboard)/home/page.tsx`**
- **ACTION**: Add patient branch to post-login routing
- **IMPLEMENT**: Before the existing `isOnboardingComplete` check, add `if (profile?.user_type === "patient") redirect("/patient-home")` (or the chosen patient-area entry path)
- **MIRROR**: existing structure at `:10-27`
- **VALIDATE**: `pnpm check-types`

**Task 22: CREATE `apps/web/app/(patient)/layout.tsx`**
- **ACTION**: Patient-area layout with auth guard and simple nav
- **IMPLEMENT**: `getServerAuth()`; redirect non-patients away (`/home` if professional/staff, `/login` if unauthenticated); render simple nav (Cartão, Agenda, Financeiro, Ferramentas) — no patient/team/enterprise management UI
- **MIRROR**: whichever `app/(dashboard)/` layout exists for structure (per analyst findings, no shared layout guard currently exists there — this is a new pattern, first shared-layout-level guard in the codebase; keep it minimal)
- **VALIDATE**: `pnpm check-types`

**Task 23: CREATE `apps/web/src/services/patient-self.ts`**
- **ACTION**: Patient-self read queries
- **IMPLEMENT**: `getMyPregnancy()`, `getMyPatientAppointments()`, `getMyBillingSummary()` — each resolves `patients.id` from `patients.user_id = auth.uid()` first (reusing the existing `"Team members can view patients"` OR-clause), then queries related tables via the anon `supabase` client (RLS already grants billing/installments/patient_documents; appointments now granted per Task 3)
- **MIRROR**: `apps/web/src/services/appointment.ts:27-53` (`getMyAppointments`) and `apps/web/src/services/patient.ts:153-171` (`getPatientById`) for client usage contract
- **VALIDATE**: `pnpm check-types`

**Task 24: CREATE `apps/web/app/(patient)/home/page.tsx`**
- **ACTION**: Patient area entry point
- **IMPLEMENT**: Fetch `getMyPregnancy()`, render summary + links to the 3 other sections
- **VALIDATE**: `pnpm check-types`; manual browser check

**Task 25: CREATE `apps/web/src/components/patient-area/prenatal-card-readonly.tsx` + `apps/web/app/(patient)/cartao-pre-natal/page.tsx`** (or under `/home` if the PRD intends a single scrollable page — confirm with user before this task if ambiguous)
- **ACTION**: Read-only prenatal card section
- **IMPLEMENT**: Strip edit/delete modal triggers from `prenatal-card.tsx`, keep only display
- **MIRROR**: `apps/web/src/components/shared/prenatal-card.tsx` (identify and remove only the interactive edit affordances, keep data display structure identical)
- **VALIDATE**: `pnpm check-types`; manual browser check

**Task 26: CREATE `apps/web/src/components/patient-area/appointment-list.tsx` + `apps/web/app/(patient)/agenda/page.tsx`**
- **ACTION**: Patient's appointment list with confirm-attendance button
- **IMPLEMENT**: List from `getMyPatientAppointments()`; per-appointment "Confirmar presença" button (disabled/hidden if `confirmed_by_patient_at` already set or appointment is in the past) calling `confirmAppointmentAttendanceAction`
- **VALIDATE**: `pnpm check-types`; manual browser check

**Task 27: CREATE `apps/web/src/actions/confirm-appointment-attendance-action.ts`**
- **ACTION**: `authActionClient` action, patient-only, sets `confirmed_by_patient_at`
- **IMPLEMENT**: Validate `ctx.profile.user_type === "patient"`; verify the appointment's `patient_id` resolves to a `patients` row with `user_id = ctx.user.id` (explicit check, not relying on RLS UPDATE grant since none was added in Task 3); `supabaseAdmin.from("appointments").update({ confirmed_by_patient_at: new Date().toISOString() }).eq("id", appointmentId)`
- **MIRROR**: `apps/web/src/actions/save-installment-link-action.ts` structure, but ADD the explicit ownership check that pattern lacks (see Gotcha in "Patterns to Mirror")
- **VALIDATE**: `pnpm check-types`; manual browser check — confirm button updates state

**Task 28: CREATE `apps/web/src/components/patient-area/billing-summary.tsx` + `apps/web/app/(patient)/financeiro/page.tsx`**
- **ACTION**: Patient's billing/installments with register-payment action
- **IMPLEMENT**: List from `getMyBillingSummary()`; per-installment "Registrar pagamento" button (hidden if `status` is already `pago`/`em_analise`/`cancelado`) opening a small form (payment method, optionally amount) calling `registerInstallmentPaymentAction`
- **VALIDATE**: `pnpm check-types`; manual browser check

**Task 29: CREATE `apps/web/src/actions/register-installment-payment-action.ts`**
- **ACTION**: `authActionClient` action, patient-only, marks installment `em_analise`
- **IMPLEMENT**: Validate `ctx.profile.user_type === "patient"`; explicit ownership check via `installments.billing_id → billings.patient_id → patients.user_id = ctx.user.id`; `supabaseAdmin.from("installments").update({ status: "em_analise", paid_amount, payment_method }).eq("id", installmentId)` — do NOT set `paid_at`
- **MIRROR**: `apps/web/src/actions/save-installment-link-action.ts` (admin mutation shape), with explicit ownership check added
- **VALIDATE**: `pnpm check-types`; manual browser check

**Task 30: CREATE `apps/web/src/actions/confirm-installment-payment-action.ts` + professional-side UI hook-in**
- **ACTION**: `authActionClient` action, professional/staff-only, confirms or rejects an `em_analise` installment
- **IMPLEMENT**: Two variants (or one action with a `decision: "confirm" | "reject"` param): confirm sets `status = "pago", paid_at = now()`; reject sets `status` back to `"pendente"` or `"atrasado"` based on due date; verify caller is `is_team_member` of the installment's patient via `supabaseAdmin` lookup before mutating; add a small UI affordance (button/badge) wherever installments are currently listed on the professional side (find the existing billing screen and add an "em análise" badge + confirm/reject buttons)
- **MIRROR**: `apps/web/src/actions/save-installment-link-action.ts`
- **VALIDATE**: `pnpm check-types`; manual browser check — professional can confirm/reject a test `em_analise` installment

### Tools Placeholder & Invite Type 2 UI (Tasks 31–33)

**Task 31: CREATE `apps/web/app/(patient)/ferramentas/page.tsx`**
- **ACTION**: Two "em breve" placeholder cards
- **IMPLEMENT**: Static cards "Medidor de contração" and "Contador de batimentos cardíacos", both disabled/greyed with an "Em breve" badge, no interactive logic
- **VALIDATE**: `pnpm check-types`; manual browser check

**Task 32: CREATE `apps/web/src/actions/create-link-existing-patient-invite-action.ts`**
- **ACTION**: `authActionClient` action creating a `link_existing` invite from an existing patient's ficha
- **IMPLEMENT**: Validate `is_team_member(patient_id)`; check `patients.user_id IS NULL` (else throw "Paciente já possui conta"); `supabaseAdmin.from("patient_invite_links").insert({ invite_type: "link_existing", patient_id, created_by: user.id, name: patients.name, email: patients.email, phone: patients.phone })`
- **MIRROR**: `apps/web/src/actions/create-patient-invite-action.ts` (Task 11) for structure
- **VALIDATE**: `pnpm check-types`

**Task 33: CREATE `apps/web/src/modals/invite-existing-patient-modal.tsx`**
- **ACTION**: "Convidar Gestante" button/modal on the patient's ficha
- **IMPLEMENT**: Trigger button on the ficha (near where "Convidar Profissional" lives), opens a modal reusing `patient-invite-share-modal.tsx`'s share UI after calling `createLinkExistingPatientInviteAction`
- **MIRROR**: `apps/web/src/modals/invite-professional-modal.tsx` (button placement + modal trigger pattern)
- **VALIDATE**: `pnpm check-types`; manual browser check

### Final Task

**Task 34: Full regression pass**
- **ACTION**: Run static analysis + full manual walkthrough
- **IMPLEMENT**: N/A
- **VALIDATE**: `pnpm check-types && npx biome lint apps/web` exits 0; manual walkthrough of both invite types end-to-end (Level 6, see Testing Strategy)

---

## Testing Strategy

### Unit Tests to Write

| Test File | Test Cases | Validates |
|---|---|---|
| `apps/web/src/lib/validations/patient-invite.test.ts` | valid/invalid payloads for all 3 schemas | Zod schemas |
| `apps/web/src/services/patient-onboarding.test.ts` | success path, pregnancy-insert failure rolls back patient, team_members-insert failure rolls back | Shared helper rollback semantics |
| `apps/web/src/actions/confirm-appointment-attendance-action.test.ts` | patient owns appointment → succeeds; patient does not own → rejected; non-patient caller → rejected | Ownership check |
| `apps/web/src/actions/register-installment-payment-action.test.ts` | patient owns installment → `em_analise`; not owner → rejected; already `pago` → rejected | Ownership + status guard |

### Edge Cases Checklist

- [ ] Invite expired (`expires_at < now()`) — both routes redirect/error correctly
- [ ] Invite already used (`used_at IS NOT NULL`) — blocked with clear message
- [ ] Type 2 invite where `patients.user_id` already set (race: two invites for same patient) — blocked
- [ ] Google OAuth signup abandoned mid-flow (user created in `auth.users`/`public.users` but never completes `/patient-registration/complete`) — document as known gap, no cleanup job in this phase
- [ ] Staff generating invite without an enterprise assigned — action throws (mirrors `add-patient-action.ts:17-18` behavior)
- [ ] Professional generating invite — `metadata.professional_ids` correctly defaults to inviter without showing Equipe step
- [ ] Split billing (`splitted_billing`) carried correctly through `metadata` and applied at invite completion
- [ ] Patient confirming attendance for an appointment that isn't hers — action rejects
- [ ] Patient registering payment for an already-`pago` installment — action rejects
- [ ] Professional rejecting an `em_analise` installment when due date has passed — status correctly returns to `atrasado` not `pendente`

---

## Validation Commands

### Level 1: STATIC_ANALYSIS
```bash
pnpm check-types
npx biome lint apps/web
```
**EXPECT**: Exit 0, no errors

### Level 2: UNIT_TESTS
```bash
# confirm actual test runner/command before running — check package.json scripts
pnpm test
```
**EXPECT**: All tests pass

### Level 3: FULL_SUITE
```bash
pnpm check-types && pnpm build
```
**EXPECT**: Build succeeds

### Level 4: DATABASE_VALIDATION
Use Supabase MCP (`mcp__supabase__list_tables`, `mcp__supabase__get_advisors`) after each migration:
- [ ] `patient_invite_links` has new columns, `token` dropped
- [ ] `appointments.confirmed_by_patient_at` exists
- [ ] `installment_status` enum includes `em_analise`
- [ ] No new RLS advisor warnings
- [ ] `handle_new_user` correctly branches on `user_type` metadata (test insert, verify, delete)

### Level 5: BROWSER_VALIDATION
Use Browser MCP or manual dev server walkthrough:
- [ ] Staff creates invite via `new-patient-modal.tsx` checkbox → shares link → opens link in incognito → completes email/password signup → lands in `/patient-home`
- [ ] Professional creates invite → completes signup via "Continuar com Google" → completes post-OAuth data step → lands in `/patient-home`
- [ ] Gestante confirms an appointment → button updates, timestamp persists
- [ ] Gestante registers a payment → installment shows "em análise" → professional confirms → installment shows "pago"
- [ ] Staff invites an existing patient (type 2) → gestante completes minimal signup → `patients.user_id` set

### Level 6: MANUAL_VALIDATION
Full walkthrough of both Interaction Changes rows in the UX Design section above, plus every item in the Edge Cases Checklist.

---

## Acceptance Criteria

- [ ] All 34 tasks completed in dependency order
- [ ] Level 1–3 validation commands pass with exit 0
- [ ] Every new server action performs an explicit ownership check before mutating patient-owned data (no reliance on implicit RLS bypass via admin client)
- [ ] `handle_new_user` correctly creates `user_type='patient'` for both invite types and both auth methods (password, Google)
- [ ] No regression in existing professional patient-creation flow (`add-patient-action.ts` still works after delegating to the shared helper)
- [ ] All patient-facing strings are pt-BR
- [ ] UX matches "After State" diagram

---

## Completion Checklist

- [ ] All tasks completed in dependency order
- [ ] Each task validated immediately after completion
- [ ] Level 1: Static analysis passes
- [ ] Level 2: Unit tests pass
- [ ] Level 3: Full test suite + build succeeds
- [ ] Level 4: Database validation passes
- [ ] Level 5: Browser validation passes
- [ ] All acceptance criteria met

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `handle_new_user` fix breaks existing professional signup | LOW | HIGH | Wrap entire trigger body in an `IF/ELSE` on `user_type`, preserving the exact existing branch untouched (Task 2) |
| Patient mutations rely on admin client without ownership checks, opening a cross-patient write hole | MEDIUM | HIGH | Every new patient-facing action (confirm attendance, register payment) does an explicit `patients.user_id = ctx.user.id` check before calling `supabaseAdmin` — do not copy `save-installment-link-action.ts`'s implicit-authorization shortcut |
| Google OAuth patients abandon mid-flow, leaving orphaned `auth.users`/`public.users` rows with no `patients` link | MEDIUM | LOW | Documented as known gap (Edge Cases Checklist); no cleanup job in this phase, consistent with existing `registration_invites` precedent which has the same gap |
| `em_analise` installments with no professional confirmation UI shipped would strand payments | LOW (mitigated by scope decision) | HIGH | Task 30 explicitly ships the professional-side confirm/reject action in this same phase, per the decision to include it |
| Extracting `createPatientWithTeamAndBilling` introduces a regression in the existing direct-creation flow | MEDIUM | MEDIUM | Task 7 explicitly calls for a before/after manual check of the existing modal flow; extraction preserves exact rollback semantics (Task 6 Mirror) |
| `patient_invite_links` migration assumes the table is currently empty/unused | LOW | MEDIUM | Confirmed via codebase-explorer: no application code references this table today — safe to alter destructively (drop `token` column) |

---

## Notes

- **Ambiguity flagged for user during implementation**: Task 25 assumes the prenatal card lives on its own route (`/cartao-pre-natal`) vs. being embedded in `/home`. The source document doesn't specify route granularity for the 4 sections beyond "4 seções" — confirm exact route names/IA with the user before or during Task 24-31 if not obvious from other Ventre navigation conventions.
- Route naming used throughout (`/patient-home`, `/agenda`, `/financeiro`, `/ferramentas`, `/cartao-pre-natal`) is a working assumption for the `app/(patient)/` group — adjust to match whatever naming convention feels most consistent with `app/(dashboard)/` at implementation time (e.g., check if dashboard uses `/patients` plural or similar pt-BR naming already).
- This plan intentionally bundles both invite types (1 and 2) and the professional-side payment confirmation UI into one phase per the user's explicit scope decisions during planning — it is large (34 tasks). If implementation proves this unwieldy, the natural split points are: (A) DB + shared helper (Tasks 1-7), (B) invite creation + registration route + OAuth (Tasks 8-20), (C) patient area sections (Tasks 21-31), (D) invite type 2 UI (Tasks 32-33).

---

*Generated: 2026-07-10*
*Status: DRAFT - ready for implementation, pending confirmation on route naming (see Notes)*
