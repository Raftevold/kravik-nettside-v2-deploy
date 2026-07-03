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
})();
