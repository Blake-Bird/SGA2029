# HPU Class of 2029 SGA — Liquid Transparency

Prestige-grade Next.js site for the Class of 2029 SGA:
- Cinematic hero with portal transitions
- 5-officer Orbit deck (flip)
- Flagship Events cinema rail + modal
- Finance snapshot with live Waterline canvas
- Ledger (virtualized), Bills Kanban (3D fold), Proposals wizard
- Invite-only preview (5 emails), ready for SSO later

## Stack

- Next.js 15 (App Router), React 19
- TypeScript for libs/components
- Zero heavy animation libs; DOM/CSS/Canvas + FLIP portals
- Images in `public/img/`

## Getting Started

```bash
# 1) Install
npm i

# 2) Create local env
cp .env.example .env.local
# Edit NEXT_PUBLIC_ALLOWED_EMAILS to the 5 preview emails

# 3) Dev
npm run dev
# http://localhost:3000

# 4) Production build
npm run build
npm start
