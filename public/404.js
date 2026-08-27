const path = window.location.pathname;
for (const el of document.querySelectorAll('#path, #path2')) {
	el.textContent = path;
}
