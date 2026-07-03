/* Admin: stadfesting før sletting/import + mal-knappar for varsellinja. */
(function () {
  'use strict';
  document.querySelectorAll('form[data-stadfest]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      if (!window.confirm(form.getAttribute('data-stadfest'))) e.preventDefault();
    });
  });

  var malFelt = document.getElementById('hurtig-text');
  document.querySelectorAll('[data-mal]').forEach(function (knapp) {
    knapp.addEventListener('click', function () {
      if (malFelt) {
        malFelt.value = knapp.getAttribute('data-mal');
        malFelt.focus();
      }
    });
  });

  /* Adresse-autoforslag frå Kartverket sitt opne API (ws.geonorge.no).
     Når brukaren vel eit forslag, blir koordinatane lagra i skjulte felt,
     slik at nettsida automatisk kan vise kart for adressa. */
  document.querySelectorAll('[data-adresse-sok]').forEach(function (input) {
    var datalist = document.getElementById(input.getAttribute('list'));
    var latFelt = document.getElementById(input.getAttribute('data-lat'));
    var lngFelt = document.getElementById(input.getAttribute('data-lng'));
    var status = document.getElementById(input.getAttribute('data-status'));
    if (!datalist || !latFelt || !lngFelt) return;
    var forslag = {};
    var timer;

    input.addEventListener('input', function () {
      var verdi = input.value;
      if (forslag[verdi]) {
        latFelt.value = forslag[verdi].lat;
        lngFelt.value = forslag[verdi].lon;
        if (status) status.textContent = '✓ Adresse funnen – kartet blir vist automatisk på sida';
        return;
      }
      latFelt.value = '';
      lngFelt.value = '';
      if (status) status.textContent = '';
      clearTimeout(timer);
      var q = verdi.trim();
      if (q.length < 4) return;
      timer = setTimeout(function () {
        fetch('https://ws.geonorge.no/adresser/v1/sok?treffPerSide=8&sok=' + encodeURIComponent(q))
          .then(function (r) { return r.json(); })
          .then(function (json) {
            datalist.textContent = '';
            forslag = {};
            (json.adresser || []).forEach(function (a) {
              if (!a.representasjonspunkt) return;
              var tekst = a.adressetekst + ', ' + a.postnummer + ' ' + a.poststed;
              forslag[tekst] = a.representasjonspunkt;
              var opt = document.createElement('option');
              opt.value = tekst;
              datalist.appendChild(opt);
            });
          })
          .catch(function () { /* nettverksfeil – forslaga uteblir, feltet verkar som vanleg */ });
      }, 250);
    });
  });
})();
