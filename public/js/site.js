/* Kr. A. Vik – klientskript: meny, samtykke, kart og biletvising. */
(function () {
  'use strict';

  /* ---------- Mobilmeny ---------- */
  var nav = document.querySelector('.hovudnav');
  var navKnapp = document.querySelector('.nav-knapp');
  if (nav && navKnapp) {
    navKnapp.addEventListener('click', function () {
      var open = nav.getAttribute('data-open') === 'true';
      nav.setAttribute('data-open', String(!open));
      navKnapp.setAttribute('aria-expanded', String(!open));
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.getAttribute('data-open') === 'true') {
        nav.setAttribute('data-open', 'false');
        navKnapp.setAttribute('aria-expanded', 'false');
        navKnapp.focus();
      }
    });
  }

  /* ---------- Samtykke ----------
     Nettsida set ingen sporingskapslar. Samtykket gjeld berre eksternt
     innhald (Google Maps) og blir lagra i localStorage – aldri sendt til oss. */
  var NOKKEL = 'kravik_samtykke_v1';
  var panel = document.getElementById('samtykke');

  function lesSamtykke() {
    try {
      return JSON.parse(localStorage.getItem(NOKKEL));
    } catch (e) {
      return null;
    }
  }

  function lagreSamtykke(eksternt) {
    try {
      localStorage.setItem(NOKKEL, JSON.stringify({ eksternt: eksternt, tid: new Date().toISOString() }));
    } catch (e) { /* private mode o.l. */ }
  }

  function lastKart(holdar) {
    var src = holdar.getAttribute('data-kart-src');
    if (!src || holdar.querySelector('iframe')) return;
    var iframe = document.createElement('iframe');
    iframe.src = src;
    iframe.title = 'Kart som viser kvar du finn oss (Google Maps)';
    iframe.loading = 'lazy';
    iframe.referrerPolicy = 'no-referrer-when-downgrade';
    iframe.allowFullscreen = true;
    holdar.textContent = '';
    holdar.appendChild(iframe);
  }

  function lastAlleKart() {
    document.querySelectorAll('.kart-holdar[data-kart-src]').forEach(lastKart);
  }

  function visPanel() {
    if (panel) panel.hidden = false;
  }

  function gohymPanel() {
    if (panel) panel.hidden = true;
  }

  var samtykke = lesSamtykke();
  if (!samtykke) {
    visPanel();
  } else if (samtykke.eksternt) {
    lastAlleKart();
  }

  document.querySelectorAll('[data-samtykke]').forEach(function (knapp) {
    knapp.addEventListener('click', function () {
      var alle = knapp.getAttribute('data-samtykke') === 'alle';
      lagreSamtykke(alle);
      gohymPanel();
      if (alle) lastAlleKart();
    });
  });

  document.querySelectorAll('[data-opne-samtykke]').forEach(function (knapp) {
    knapp.addEventListener('click', function () {
      visPanel();
      var forste = panel && panel.querySelector('button');
      if (forste) forste.focus();
    });
  });

  /* «Vis kart»-knappen gjeld som samtykke til eksternt innhald */
  document.querySelectorAll('[data-last-kart]').forEach(function (knapp) {
    knapp.addEventListener('click', function () {
      lagreSamtykke(true);
      gohymPanel();
      lastAlleKart();
    });
  });

  /* ---------- Før/etter-glidar (prosjektsider) ---------- */
  document.querySelectorAll('[data-foretter]').forEach(function (boks) {
    var slider = boks.querySelector('.foretter-slider');
    if (!slider) return;
    var oppdater = function () {
      boks.style.setProperty('--pos', slider.value + '%');
    };
    slider.addEventListener('input', oppdater);
    oppdater();
  });

  /* ---------- Biletvising (lysbilete) ---------- */
  var dialog = document.querySelector('.lysbilete');
  if (dialog && typeof dialog.showModal === 'function') {
    var bilete = dialog.querySelector('img');
    var lukk = dialog.querySelector('.lysbilete-lukk');

    document.querySelectorAll('.galleri-knapp').forEach(function (knapp) {
      knapp.addEventListener('click', function () {
        bilete.src = knapp.getAttribute('data-lysbilete');
        bilete.alt = knapp.getAttribute('data-alt') || '';
        dialog.showModal();
      });
    });

    lukk.addEventListener('click', function () {
      dialog.close();
    });

    dialog.addEventListener('click', function (e) {
      if (e.target === dialog) dialog.close();
    });

    dialog.addEventListener('close', function () {
      bilete.src = '';
    });
  }
})();
