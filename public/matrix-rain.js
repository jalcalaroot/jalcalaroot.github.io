const canvas = document.getElementById('matrix-rain');
const ctx = canvas.getContext('2d');
const chars = 'アカサタナハマヤラワ0123456789日ロブラウザABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

let columns;
let drops;
const fontSize = 16;

function resize() {
	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;
	columns = Math.floor(canvas.width / fontSize);
	drops = new Array(columns).fill(1);
}

resize();
window.addEventListener('resize', resize);

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function draw() {
	ctx.fillStyle = 'rgba(0, 0, 0, 0.06)';
	ctx.fillRect(0, 0, canvas.width, canvas.height);

	ctx.fillStyle = '#00ff66';
	ctx.font = `${fontSize}px monospace`;

	for (let i = 0; i < drops.length; i++) {
		const text = chars[Math.floor(Math.random() * chars.length)];
		ctx.fillText(text, i * fontSize, drops[i] * fontSize);

		if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
			drops[i] = 0;
		}
		drops[i]++;
	}
}

if (!prefersReducedMotion) {
	setInterval(draw, 40);
} else {
	ctx.fillStyle = 'rgba(0, 0, 0, 1)';
	ctx.fillRect(0, 0, canvas.width, canvas.height);
}
