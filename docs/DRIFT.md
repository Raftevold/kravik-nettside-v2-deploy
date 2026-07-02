# Drift

## Miljøvariablar (Render → Environment)

| Variabel | Påkravd | Forklaring |
|---|---|---|
| `SITE_URL` | tilrådd | Offentleg adresse (til sitemap/canonical/JSON-LD) |
| `SESSION_SECRET` | ja | Lang tilfeldig streng – held admin-innlogging gyldig over omstart |
| `ADMIN_USER` | nei | Standard `admin` |
| `ADMIN_PASSWORD_HASH` | nei | Overstyrer passordet i `data/auth.json` (bcrypt-hash) |
| `GITHUB_TOKEN` | ja* | Token med `contents: read/write` på dette repoet |
| `GITHUB_REPO` | ja* | T.d. `Raftevold/kravik-nettside` |
| `GITHUB_BRANCH` | nei | Standard `main` |
| `SMTP_HOST/PORT/USER/PASS` | nei | Aktiverer e-postvarsling for kontaktskjema |
| `CONTACT_EMAIL` | nei | Mottakar for varsling (standard: SMTP_USER) |

\* Utan GitHub-variablane køyrer sida fint, men admin-endringar forsvinn når
tenesta startar på nytt (Render gratisplan har flyktig filsystem). Med dei blir
kvar lagring committa til repoet og henta ned att ved oppstart.

**Tilråding:** bruk ein *fine-grained personal access token* avgrensa til dette
eine repoet (GitHub → Settings → Developer settings → Fine-grained tokens →
Repository access: berre dette repoet → Permissions: Contents read/write).

## Render gratisplan – kjende avgrensingar

- **Dvale:** tenesta søv etter ~15 min utan trafikk; første besøk etterpå tek
  30–60 sekund. Betalt plan fjernar dette.
- **Flyktig filsystem:** løyst med GitHub-synk (sjå over).
- **Deploy ved innhaldsendring:** `render.yaml` har `buildFilter.ignoredPaths:
  data/**`, så innhaldscommits frå admin utløyser IKKJE ny deploy.

## Sikkerheitskopi

- Admin → Innstillingar → «Last ned innhald (JSON)».
- Heile historikken ligg dessutan i git – kvar admin-lagring er ein commit.
  Rull tilbake ved å reverte commiten og starte tenesta på nytt.

## E-post for kontaktskjema

Meldingar blir alltid lagra i admin-innboksen. For e-postvarsling i tillegg:
sett SMTP-variablane (t.d. frå Domeneshop/One.com/Microsoft 365 som bedrifta
alt brukar for @kravik.no-adressene).

## Personvern i drift

- Meldingar frå skjemaet inneheld persondata og blir synkroniserte til
  **privat** GitHub-repo. Ikkje gjer repoet offentleg.
- Slett gamle meldingar i admin når dei er ferdig behandla.
