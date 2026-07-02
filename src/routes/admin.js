const crypto = require('crypto');
const express = require('express');
const cookieSession = require('cookie-session');
const multer = require('multer');
const store = require('../lib/store');
const auth = require('../lib/auth');
const images = require('../lib/images');
const mail = require('../lib/mail');

const router = express.Router();

const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
if (!process.env.SESSION_SECRET) {
  console.warn('[admin] SESSION_SECRET er ikkje sett – innlogging blir nullstilt ved omstart.');
}

router.use(
  cookieSession({
    name: 'kravik_admin',
    keys: [SESSION_SECRET],
    maxAge: 8 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/admin',
  })
);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024, files: 20 },
});

// Ikkje indekser admin
router.use((req, res, next) => {
  res.set('X-Robots-Tag', 'noindex, nofollow');
  res.locals.admin = true;
  res.locals.csrf = (req.session && req.session.csrf) || '';
  res.locals.flash = req.session ? req.session.flash : null;
  if (req.session) req.session.flash = null;
  next();
});

function flash(req, text, type = 'ok') {
  if (req.session) req.session.flash = { text, type };
}

function str(v, max = 2000) {
  return String(v ?? '').trim().slice(0, max);
}

// ---------- Innlogging ----------
router.get('/logg-inn', (req, res) => {
  if (req.session && req.session.user) return res.redirect('/admin');
  res.render('admin/login', { error: null, hasPassword: auth.hasPassword() });
});

router.post('/logg-inn', auth.loginLimiter, (req, res) => {
  const { brukar, passord } = req.body;
  if (auth.verifyLogin(str(brukar, 100), String(passord || ''))) {
    auth.startSession(req);
    return res.redirect('/admin');
  }
  res.status(401).render('admin/login', { error: 'Feil brukarnamn eller passord.', hasPassword: auth.hasPassword() });
});

router.post('/logg-ut', (req, res) => {
  req.session = null;
  res.redirect('/admin/logg-inn');
});

// Alt under her krev innlogging
router.use(auth.requireAuth);
router.get('/', (req, res) => res.redirect('/admin/oversikt'));

// Alle POST krev gyldig CSRF-token
router.post('*', auth.verifyCsrf, (req, res, next) => next());

// ---------- Oversikt ----------
router.get('/oversikt', (req, res) => {
  const messages = store.getMessages();
  res.render('admin/oversikt', {
    unread: messages.filter((m) => !m.read).length,
    total: messages.length,
    sync: store.syncStatus(),
    mailConfigured: mail.configured,
  });
});

// ---------- Generelt (kontaktinfo m.m.) ----------
router.get('/generelt', (req, res) => {
  res.render('admin/generelt', {});
});

router.post('/generelt', (req, res) => {
  const c = store.getContent();
  const b = req.body;
  c.site.name = str(b.name, 100) || c.site.name;
  c.site.tagline = str(b.tagline, 200);
  c.site.orgnr = str(b.orgnr, 20);
  c.site.phone = str(b.phone, 30);
  c.site.email = str(b.email, 100);
  c.site.address = { street: str(b.street, 100), zip: str(b.zip, 10), city: str(b.city, 60) };
  c.site.mapEmbed = str(b.mapEmbed, 2000);
  c.site.openingHoursNote = str(b.openingHoursNote, 300);
  c.site.openingHours = str(b.openingHours, 2000)
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [label, ...rest] = l.split('|');
      return { label: str(label, 60), value: str(rest.join('|'), 60) };
    })
    .filter((o) => o.label && o.value);
  c.site.social = str(b.social, 2000)
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [type, ...rest] = l.split('|');
      return { type: str(type, 30).toLowerCase(), url: str(rest.join('|'), 300) };
    })
    .filter((s) => s.type && /^https?:\/\//.test(s.url));
  c.site.departments = [];
  for (let i = 0; i < 4; i++) {
    const name = str(b[`dep_name_${i}`], 100);
    if (!name) continue;
    c.site.departments.push({
      name,
      address: str(b[`dep_address_${i}`], 150),
      phone: str(b[`dep_phone_${i}`], 30),
      note: str(b[`dep_note_${i}`], 150),
    });
  }
  store.saveContent(c, 'kontaktinfo og generelt');
  flash(req, 'Lagra!');
  res.redirect('/admin/generelt');
});

// ---------- Varsellinje ----------
router.get('/varsellinje', (req, res) => res.render('admin/varsellinje', {}));

router.post('/varsellinje', (req, res) => {
  const c = store.getContent();
  c.alert = {
    enabled: req.body.enabled === 'on',
    text: str(req.body.text, 300),
    link: str(req.body.link, 300),
  };
  store.saveContent(c, 'varsellinje');
  flash(req, c.alert.enabled ? 'Varsellinja er PÅ.' : 'Varsellinja er AV.');
  res.redirect('/admin/varsellinje');
});

// ---------- Sider (tekst + SEO) ----------
const PAGE_DEFS = {
  home: {
    label: 'Framsida',
    fields: [
      ['heroTitle', 'Hovudoverskrift (hero)', 'text'],
      ['heroLead', 'Ingress (hero)', 'textarea'],
      ['heroImage', 'Hero-bilete', 'image'],
      ['ctaPrimaryText', 'Primærknapp-tekst', 'text'],
      ['ctaSecondaryText', 'Sekundærknapp-tekst', 'text'],
    ],
  },
  tenester: {
    label: 'Tenester',
    fields: [
      ['intro', 'Introtekst', 'textarea'],
      ['headerImage', 'Toppbilete', 'image'],
    ],
  },
  omOss: {
    label: 'Om oss',
    fields: [
      ['body', 'Brødtekst', 'textarea'],
      ['headerImage', 'Toppbilete', 'image'],
    ],
  },
  butikk: {
    label: 'Butikk og landbruk',
    fields: [
      ['intro', 'Introtekst', 'textarea'],
      ['comfortText', 'Tekst om Comfort-butikken', 'textarea'],
      ['landbrukText', 'Tekst om landbruksavdelinga', 'textarea'],
      ['headerImage', 'Toppbilete', 'image'],
    ],
  },
  opplaering: {
    label: 'Opplæringsbedrift',
    fields: [
      ['body', 'Brødtekst', 'textarea'],
      ['headerImage', 'Toppbilete', 'image'],
    ],
  },
  eigedom: {
    label: 'Eigedom',
    fields: [
      ['body', 'Brødtekst', 'textarea'],
      ['orgnr', 'Org.nr (eigedomsselskapet)', 'text'],
      ['contactName', 'Kontaktperson', 'text'],
      ['contactRole', 'Rolle', 'text'],
      ['contactPhone', 'Telefon', 'text'],
      ['contactEmail', 'E-post', 'text'],
      ['contactImage', 'Bilete av kontaktperson', 'image'],
      ['headerImage', 'Toppbilete', 'image'],
    ],
  },
  miljo: {
    label: 'Miljø og berekraft',
    fields: [
      ['body', 'Brødtekst', 'textarea'],
      ['docsRaw', 'Dokument (éi linje per dokument: Tittel|URL)', 'textarea'],
      ['headerImage', 'Toppbilete', 'image'],
    ],
  },
  kontakt: {
    label: 'Kontakt',
    fields: [
      ['intro', 'Introtekst', 'textarea'],
      ['headerImage', 'Toppbilete', 'image'],
    ],
  },
  galleri: {
    label: 'Galleri (SEO)',
    fields: [],
  },
};

router.get('/sider', (req, res) => res.render('admin/sider', { PAGE_DEFS }));

router.get('/sider/:key', (req, res) => {
  const def = PAGE_DEFS[req.params.key];
  if (!def) return res.redirect('/admin/sider');
  const c = store.getContent();
  const pageData = { ...c.pages[req.params.key] };
  if (req.params.key === 'miljo') {
    pageData.docsRaw = (pageData.docs || []).map((d) => `${d.title}|${d.url}`).join('\n');
  }
  res.render('admin/side-edit', { def, key: req.params.key, pageData });
});

router.post('/sider/:key', (req, res) => {
  const def = PAGE_DEFS[req.params.key];
  if (!def) return res.redirect('/admin/sider');
  const c = store.getContent();
  const p = c.pages[req.params.key];
  p.seoTitle = str(req.body.seoTitle, 70);
  p.seoDescription = str(req.body.seoDescription, 170);
  for (const [name, , type] of def.fields) {
    if (name === 'docsRaw') {
      p.docs = str(req.body.docsRaw, 5000)
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => {
          const [title, ...rest] = l.split('|');
          return { title: str(title, 120), url: str(rest.join('|'), 500) };
        })
        .filter((d) => d.title && /^https?:\/\//.test(d.url));
    } else if (type === 'textarea') {
      p[name] = str(req.body[name], 10000);
    } else {
      p[name] = str(req.body[name], 300);
    }
  }
  store.saveContent(c, `sida «${def.label}»`);
  flash(req, 'Lagra!');
  res.redirect(`/admin/sider/${req.params.key}`);
});

// ---------- Tenester ----------
const ICONS = ['bad', 'kran', 'varme', 'sprinkler', 'va', 'sveis', 'kamera', 'bor', 'verktoy'];

router.get('/tenester', (req, res) => res.render('admin/tenester', { ICONS }));

router.post('/tenester/lagre', (req, res) => {
  const c = store.getContent();
  const idx = Number(req.body.index);
  const item = {
    id: str(req.body.id, 40) || `teneste-${Date.now().toString(36)}`,
    title: str(req.body.title, 100),
    icon: ICONS.includes(req.body.icon) ? req.body.icon : 'verktoy',
    text: str(req.body.text, 1000),
  };
  if (!item.title) {
    flash(req, 'Tittel manglar.', 'feil');
    return res.redirect('/admin/tenester');
  }
  if (Number.isInteger(idx) && idx >= 0 && idx < c.services.length) c.services[idx] = item;
  else c.services.push(item);
  store.saveContent(c, 'tenester');
  flash(req, 'Lagra!');
  res.redirect('/admin/tenester');
});

router.post('/tenester/slett', (req, res) => {
  const c = store.getContent();
  const idx = Number(req.body.index);
  if (Number.isInteger(idx) && idx >= 0 && idx < c.services.length) c.services.splice(idx, 1);
  store.saveContent(c, 'tenester');
  flash(req, 'Sletta.');
  res.redirect('/admin/tenester');
});

router.post('/tenester/flytt', (req, res) => {
  const c = store.getContent();
  const idx = Number(req.body.index);
  const dir = req.body.dir === 'opp' ? -1 : 1;
  const j = idx + dir;
  if (idx >= 0 && idx < c.services.length && j >= 0 && j < c.services.length) {
    [c.services[idx], c.services[j]] = [c.services[j], c.services[idx]];
    store.saveContent(c, 'tenester (rekkjefølgje)');
  }
  res.redirect('/admin/tenester');
});

// ---------- Team ----------
router.get('/team', (req, res) => res.render('admin/team', {}));

router.post('/team/lagre', (req, res) => {
  const c = store.getContent();
  const idx = Number(req.body.index);
  const item = {
    name: str(req.body.name, 100),
    role: str(req.body.role, 120),
    phone: str(req.body.phone, 30),
    email: str(req.body.email, 100),
    image: str(req.body.image, 60),
  };
  if (!item.name) {
    flash(req, 'Namn manglar.', 'feil');
    return res.redirect('/admin/team');
  }
  if (Number.isInteger(idx) && idx >= 0 && idx < c.team.length) c.team[idx] = item;
  else c.team.push(item);
  store.saveContent(c, 'kontaktpersonar');
  flash(req, 'Lagra!');
  res.redirect('/admin/team');
});

router.post('/team/slett', (req, res) => {
  const c = store.getContent();
  const idx = Number(req.body.index);
  if (Number.isInteger(idx) && idx >= 0 && idx < c.team.length) c.team.splice(idx, 1);
  store.saveContent(c, 'kontaktpersonar');
  flash(req, 'Sletta.');
  res.redirect('/admin/team');
});

// ---------- Referansar ----------
router.get('/referansar', (req, res) => res.render('admin/referansar', {}));

router.post('/referansar/lagre', (req, res) => {
  const c = store.getContent();
  const idx = Number(req.body.index);
  const item = {
    quote: str(req.body.quote, 800),
    author: str(req.body.author, 100),
    context: str(req.body.context, 120),
  };
  if (!item.quote || !item.author) {
    flash(req, 'Både sitat og namn må fyllast ut.', 'feil');
    return res.redirect('/admin/referansar');
  }
  if (Number.isInteger(idx) && idx >= 0 && idx < c.testimonials.length) c.testimonials[idx] = item;
  else c.testimonials.push(item);
  store.saveContent(c, 'referansar');
  flash(req, 'Lagra!');
  res.redirect('/admin/referansar');
});

router.post('/referansar/slett', (req, res) => {
  const c = store.getContent();
  const idx = Number(req.body.index);
  if (Number.isInteger(idx) && idx >= 0 && idx < c.testimonials.length) c.testimonials.splice(idx, 1);
  store.saveContent(c, 'referansar');
  flash(req, 'Sletta.');
  res.redirect('/admin/referansar');
});

// ---------- Eigedom (leilegheiter) ----------
router.get('/eigedom', (req, res) => res.render('admin/eigedom', {}));

router.post('/eigedom/lagre', (req, res) => {
  const c = store.getContent();
  const idx = Number(req.body.index);
  const item = { title: str(req.body.title, 150), image: str(req.body.image, 60) };
  if (!item.title) {
    flash(req, 'Tittel manglar.', 'feil');
    return res.redirect('/admin/eigedom');
  }
  if (Number.isInteger(idx) && idx >= 0 && idx < c.properties.length) c.properties[idx] = item;
  else c.properties.push(item);
  store.saveContent(c, 'leilegheiter');
  flash(req, 'Lagra!');
  res.redirect('/admin/eigedom');
});

router.post('/eigedom/slett', (req, res) => {
  const c = store.getContent();
  const idx = Number(req.body.index);
  if (Number.isInteger(idx) && idx >= 0 && idx < c.properties.length) c.properties.splice(idx, 1);
  store.saveContent(c, 'leilegheiter');
  flash(req, 'Sletta.');
  res.redirect('/admin/eigedom');
});

// ---------- Bilete (mediebibliotek + galleri) ----------
router.get('/bilete', (req, res) => res.render('admin/bilete', {}));

router.post('/bilete/last-opp', upload.array('bilete', 20), async (req, res) => {
  const c = store.getContent();
  c.media = c.media || [];
  c.gallery = c.gallery || [];
  const addToGallery = req.body.tilGalleri === 'on';
  let count = 0;
  for (const file of req.files || []) {
    if (!/^image\/(jpeg|png|webp|avif|gif)$/.test(file.mimetype)) continue;
    try {
      const entry = await images.processUpload(
        file.buffer,
        file.originalname,
        c.media.map((m) => m.id)
      );
      c.media.push(entry);
      if (addToGallery) c.gallery.push({ image: entry.id });
      count++;
    } catch (err) {
      console.error('[opplasting]', err.message);
    }
  }
  store.saveContent(c, `bilete (${count} opplasta)`);
  flash(req, count ? `${count} bilete lasta opp.` : 'Ingen bilete vart lasta opp – sjekk filformatet.', count ? 'ok' : 'feil');
  res.redirect('/admin/bilete');
});

router.post('/bilete/alt', (req, res) => {
  const c = store.getContent();
  const m = (c.media || []).find((x) => x.id === req.body.id);
  if (m) {
    m.alt = str(req.body.alt, 200);
    store.saveContent(c, 'alt-tekst');
    flash(req, 'Alt-tekst lagra.');
  }
  res.redirect('/admin/bilete');
});

router.post('/bilete/slett', (req, res) => {
  const c = store.getContent();
  const id = str(req.body.id, 60);
  c.media = (c.media || []).filter((m) => m.id !== id);
  c.gallery = (c.gallery || []).filter((g) => g.image !== id);
  images.deleteMedia(id);
  store.saveContent(c, 'sletta bilete');
  flash(req, 'Biletet er sletta.');
  res.redirect('/admin/bilete');
});

router.post('/galleri/toggle', (req, res) => {
  const c = store.getContent();
  const id = str(req.body.id, 60);
  c.gallery = c.gallery || [];
  const idx = c.gallery.findIndex((g) => g.image === id);
  if (idx >= 0) c.gallery.splice(idx, 1);
  else c.gallery.push({ image: id });
  store.saveContent(c, 'galleri');
  res.redirect('/admin/bilete');
});

// ---------- Meldingar ----------
router.get('/meldingar', (req, res) => {
  res.render('admin/meldingar', { messages: store.getMessages(), mailConfigured: mail.configured });
});

router.post('/meldingar/lest', (req, res) => {
  store.markMessageRead(str(req.body.id, 40), req.body.lest !== '0');
  res.redirect('/admin/meldingar');
});

router.post('/meldingar/slett', (req, res) => {
  store.deleteMessage(str(req.body.id, 40));
  flash(req, 'Melding sletta.');
  res.redirect('/admin/meldingar');
});

// ---------- Innstillingar (passord + backup) ----------
router.get('/innstillingar', (req, res) => {
  res.render('admin/innstillingar', { sync: store.syncStatus(), mailConfigured: mail.configured });
});

router.post('/innstillingar/passord', (req, res) => {
  const { gjeldande, nytt, gjenta } = req.body;
  if (!auth.verifyLogin(auth.ADMIN_USER, String(gjeldande || ''))) {
    flash(req, 'Gjeldande passord er feil.', 'feil');
  } else if (String(nytt || '').length < 10) {
    flash(req, 'Nytt passord må ha minst 10 teikn.', 'feil');
  } else if (nytt !== gjenta) {
    flash(req, 'Passorda er ikkje like.', 'feil');
  } else if (process.env.ADMIN_PASSWORD_HASH) {
    flash(req, 'Passordet er styrt av miljøvariabelen ADMIN_PASSWORD_HASH og kan ikkje endrast her.', 'feil');
  } else {
    auth.setPassword(String(nytt));
    flash(req, 'Passordet er endra.');
  }
  res.redirect('/admin/innstillingar');
});

router.get('/eksport', (req, res) => {
  res.setHeader('Content-Disposition', 'attachment; filename="kravik-innhald.json"');
  res.type('application/json').send(JSON.stringify(store.getContent(), null, 2));
});

router.post('/import', upload.single('fil'), (req, res) => {
  try {
    const json = JSON.parse(req.file.buffer.toString('utf8'));
    if (!json.site || !json.pages) throw new Error('Fila manglar «site»/«pages».');
    store.saveContent(json, 'import av innhald');
    flash(req, 'Innhald importert.');
  } catch (err) {
    flash(req, `Import feila: ${err.message}`, 'feil');
  }
  res.redirect('/admin/innstillingar');
});

module.exports = router;
