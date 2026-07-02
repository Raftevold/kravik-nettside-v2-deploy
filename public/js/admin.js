/* Admin: stadfesting før sletting/import. */
(function () {
  'use strict';
  document.querySelectorAll('form[data-stadfest]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      if (!window.confirm(form.getAttribute('data-stadfest'))) e.preventDefault();
    });
  });
})();
