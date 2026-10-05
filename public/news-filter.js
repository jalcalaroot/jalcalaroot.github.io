// Provider filter for /news/. Kept as a static file so it passes the site's CSP (script-src 'self').
(function () {
	var buttons = document.querySelectorAll('.filters button');
	var rows = document.querySelectorAll('.news-list li');
	buttons.forEach(function (btn) {
		btn.addEventListener('click', function () {
			var f = btn.dataset.filter;
			buttons.forEach(function (b) {
				b.setAttribute('aria-pressed', String(b === btn));
			});
			rows.forEach(function (r) {
				r.hidden = f !== 'all' && r.dataset.provider !== f;
			});
		});
	});
})();
