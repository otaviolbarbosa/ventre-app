# Objective
Improve professional registration by a staff member.

## Functionalities
- Create a new migration for registration_invites table where we should register new users registration invites, with columns: id, name, email, phone, professional_type, invited_by, enterprise_id, expired_at, completed_at. 
- Create route /complete-registration?riid=<ID> to allow users to complete their registration, showing a stepped form to let users create their profile - riid is registration invite ID
  - Step 1: Add password
  - Step 2: Add Image and confirm data already provided in registration_invites table (name, email, phone, professional_type and enterprise)
  - Steo 3: Confirmation screen - do not show password value here.
- Point the registration link in apps/web/src/lib/emails/send-professional-invite.ts to /complete-registration?riid=<ID>

## Requirements
- Table columns are meaninful and self-explained, you should store values accordingly.
- Create supabase functions and RLS policies when needed
- Revisit actions already created to ensure everything will work
