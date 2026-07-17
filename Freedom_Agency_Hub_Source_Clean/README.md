# Freedom Agency Hub

Production starter for Freedom Auto Insurance.

## Included
- Responsive black-and-gold interface
- Dashboard and customer module
- Next.js 16 project structure
- Supabase browser client
- PostgreSQL schema for agencies, staff, customers, vehicles, policies, and payments
- Row-level security starter policies
- PWA manifest for adding to an iPhone home screen
- Vercel-compatible deployment

## Local setup
1. Install Node.js 20 or newer.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local` (never commit `.env.local`).
4. Create a Supabase project.
5. Paste `supabase/schema.sql` into the Supabase SQL Editor and run it.
6. Add the Supabase Project URL and publishable key to `.env.local`.
7. Run `npm run dev`.

## Go live on Vercel
1. Upload this folder to a private GitHub repository.
2. Import that repository into Vercel.
3. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in Vercel Environment Variables for Production, Preview, and Development.
4. Deploy.
5. Add `app.freedomautoagency.com` in Vercel Domains, then add the exact DNS record Vercel displays at your domain provider.

## First owner setup
1. In Supabase Authentication, disable public sign-ups and create the owner's user manually.
2. In the SQL Editor, create one agency row and one profile row whose `id` exactly matches the owner's Authentication user ID.
3. Set the profile role to `owner`.
4. Require MFA for every employee before entering real customer data.

## Important production requirements
Before entering real insurance customer data:
- Complete authentication and employee invitations.
- Expand row-level security policies to every table.
- Enable MFA for staff.
- Add audit logs.
- Establish data retention and breach-response procedures.
- Obtain legal/compliance review for handling driver and insurance information.
- Do not store carrier passwords in plaintext.
