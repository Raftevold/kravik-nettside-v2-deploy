const { createApp } = require('./src/app');
const store = require('./src/lib/store');

const PORT = process.env.PORT || 3000;

(async () => {
  try {
    await store.init();
  } catch (err) {
    console.error('[boot] Klarte ikkje å initialisere datalager:', err);
  }
  const app = createApp();
  app.listen(PORT, () => {
    console.log(`Kr. A. Vik-nettsida køyrer på http://localhost:${PORT}`);
  });
})();
