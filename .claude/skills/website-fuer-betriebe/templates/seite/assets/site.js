(function () {
  'use strict';

  /* Menü auf dem Handy */
  var knopf = document.querySelector('.kopf__menue');
  var nav = document.getElementById('hauptmenue');
  if (knopf && nav) {
    knopf.addEventListener('click', function () {
      var offen = nav.classList.toggle('ist-offen');
      knopf.setAttribute('aria-expanded', String(offen));
    });
    nav.addEventListener('click', function (e) {
      if (e.target.closest('a')) { nav.classList.remove('ist-offen'); knopf.setAttribute('aria-expanded', 'false'); }
    });
  }

  /* Externe Inhalte erst nach Klick laden (Zwei-Klick). Vorher keine Verbindung zum Anbieter. */
  document.querySelectorAll('[data-extern-src]').forEach(function (box) {
    var los = box.querySelector('[data-extern-laden]');
    if (!los) return;
    los.addEventListener('click', function () {
      var f = document.createElement('iframe');
      f.src = box.getAttribute('data-extern-src');
      f.title = box.getAttribute('data-extern-titel') || 'Eingebetteter Inhalt';
      f.loading = 'lazy';
      f.referrerPolicy = 'strict-origin-when-cross-origin';
      f.allowFullscreen = true;
      box.replaceChildren(f);
      box.classList.add('ist-geladen');
      f.focus();
    });
  });

  /* Kontaktformular an den n8n-Webhook; bei Fehler bleibt der Text stehen und die E-Mail wird angeboten */
  document.querySelectorAll('form[data-webhook]').forEach(function (form) {
    var status = form.querySelector('.formular__status');
    var senden = form.querySelector('[type="submit"]');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }
      if (form.elements.website && form.elements.website.value) return; // Spam-Falle
      senden.disabled = true;
      status.textContent = 'Wird gesendet …';
      fetch(form.action, { method: 'POST', body: new FormData(form) })
        .then(function (r) {
          if (!r.ok) throw new Error(r.status);
          form.reset();
          status.textContent = 'Danke, Ihre Anfrage ist angekommen. Wir melden uns.';
        })
        .catch(function () {
          var mail = document.querySelector('a[href^="mailto:"]');
          status.textContent = 'Das hat nicht geklappt. Bitte rufen Sie an oder schreiben Sie eine E-Mail' +
            (mail ? ' an ' + mail.textContent : '') + '.';
        })
        .finally(function () { senden.disabled = false; });
    });
  });

  /* Jahr im Fuß */
  document.querySelectorAll('[data-jahr]').forEach(function (el) { el.textContent = new Date().getFullYear(); });
})();
