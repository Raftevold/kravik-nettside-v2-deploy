# Kr. A. Vik AS – nettside

Moderne, rask og universelt utforma nettside for Kr. A. Vik AS – familieeigd
rørleggarbedrift i Stryn og på Nordfjordeid sidan 1933. Bygd som erstatning for
gamle kravik.no.

## Teknologi

- **Node.js 22 + Express + EJS** – server-rendert HTML, ingen byggjesteg
- **Innebygd CMS** på `/admin` – all tekst, bilete, tenester, kontaktinfo,
  opningstider, referansar, SEO-felt og varsellinje kan endrast utan kode
- **sharp** – alle bilete blir automatisk konverterte til WebP i tre storleikar
- **GitHub-basert persistens** – innhald og opplasta bilete blir committa til
  dette repoet og henta ned att ved oppstart, slik at endringar overlever
  Render gratisplan sitt flyktige filsystem
- **Tryggleik** – helmet (CSP med nonce), bcrypt, rate-limiting, CSRF-vern,
  signerte sesjonscookies

## Kom i gang lokalt

```bash
npm install
npm start          # http://localhost:3000
```

Innlogging til admin: sjå `docs/ADMIN.md`.

## Deploy

Sjå `render.yaml` (Render Blueprint) og `docs/DRIFT.md` for miljøvariablar,
GitHub-synk og e-postoppsett.

## Dokumentasjon

- `docs/ANALYSE.md` – vurdering av gamle sida + strategi for den nye
- `docs/ADMIN.md` – brukarrettleiing for administrasjonssida
- `docs/DRIFT.md` – drift, miljøvariablar, backup og kjende avgrensingar
