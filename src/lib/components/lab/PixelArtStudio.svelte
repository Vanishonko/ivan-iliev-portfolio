<script lang="ts">
	interface Props {
		class?: string;
	}

	let { class: className = '' }: Props = $props();

	const SIZE = 32;
	const HISTORY_LIMIT = 30;

	type Tool = 'pen' | 'eraser' | 'eyedropper';
	type Cell = { x: number; y: number };
	type PaletteEntry = { name: string; hex: string; ink: string };
	type GalleryMotion =
		| { kind: 'bob'; duration: number }
		| { kind: 'strip'; frames: number; durations: number[]; preset: 'even' | 'blink' };
	type GalleryItem = {
		id: string;
		src: string;
		label: string;
		meta: string;
		motion?: GalleryMotion;
		decode:
			| { kind: 'pixels'; x: number; y: number }
			| { kind: 'sample'; x: number; y: number; step: number };
	};

	const PALETTE: PaletteEntry[] = [
		{ name: 'Void', hex: '#14141c', ink: '#f5f4f1' },
		{ name: 'Pine', hex: '#0d1f18', ink: '#f5f4f1' },
		{ name: 'Forest', hex: '#2b6b4a', ink: '#f5f4f1' },
		{ name: 'Leaf', hex: '#3f8f5b', ink: '#0b0c12' },
		{ name: 'Slime', hex: '#5cae6c', ink: '#0b0c12' },
		{ name: 'Mint', hex: '#9ad48b', ink: '#0b0c12' },
		{ name: 'Night', hex: '#141f33', ink: '#f5f4f1' },
		{ name: 'Bone', hex: '#eefaf0', ink: '#0b0c12' },
		{ name: 'Violet', hex: '#5b3fa8', ink: '#f5f4f1' },
		{ name: 'Iris', hex: '#a78bfa', ink: '#0b0c12' },
		{ name: 'Amber', hex: '#f5b84b', ink: '#0b0c12' },
		{ name: 'Sky', hex: '#7dd3fc', ink: '#0b0c12' }
	];

	const TOOLS: { id: Tool; label: string; hint: string }[] = [
		{ id: 'pen', label: 'Pen', hint: 'paint with the selected colour' },
		{ id: 'eraser', label: 'Eraser', hint: 'erase pixels to transparency' },
		{ id: 'eyedropper', label: 'Pick', hint: 'sample a colour from the canvas' }
	];

	const GALLERY: GalleryItem[] = [
		{
			id: 'idle',
			src: '/pixelart/slime-idle.png',
			label: 'Slime idle',
			meta: 'idle · 32×32',
			motion: { kind: 'bob', duration: 2000 },
			decode: { kind: 'pixels', x: 0, y: 0 }
		},
		{
			id: 'blink',
			src: '/pixelart/slime-blink.png',
			label: 'Slime blink',
			meta: 'blink · frame 1/3',
			// Percentages below match 900 / 120 / 140 ms out of 1160 ms.
			motion: { kind: 'strip', frames: 3, durations: [900, 120, 140], preset: 'blink' },
			decode: { kind: 'pixels', x: 0, y: 0 }
		},
		{
			id: 'hop',
			src: '/pixelart/blob-hop.png',
			label: 'Blob hop',
			meta: 'hop · 4 frames',
			motion: { kind: 'strip', frames: 4, durations: [180, 180, 180, 180], preset: 'even' },
			decode: { kind: 'pixels', x: 0, y: 0 }
		},
		{
			id: 'candle',
			src: '/pixelart/candle-flicker.png',
			label: 'Candle flicker',
			meta: 'flicker · 4 frames',
			motion: { kind: 'strip', frames: 4, durations: [220, 220, 220, 220], preset: 'even' },
			decode: { kind: 'pixels', x: 0, y: 0 }
		},
		{
			id: 'review',
			src: '/pixelart/slime-blink-review.png',
			label: 'Plugin review sheet',
			meta: 'review · frame 3/3',
			decode: { kind: 'sample', x: 548, y: 16, step: 8 }
		}
	];

	const REVIEW_BACKGROUND = [
		[20, 20, 28],
		[22, 22, 29],
		[26, 26, 33]
	];

	const emptyGrid = (): string[] => Array.from({ length: SIZE * SIZE }, () => '');
	const hexToRgb = (hex: string): [number, number, number] => [
		parseInt(hex.slice(1, 3), 16),
		parseInt(hex.slice(3, 5), 16),
		parseInt(hex.slice(5, 7), 16)
	];
	const PALETTE_RGB = PALETTE.map((entry) => ({ hex: entry.hex, rgb: hexToRgb(entry.hex) }));

	let canvasEl = $state<HTMLCanvasElement | null>(null);
	let pixels = $state<string[]>(emptyGrid());
	let undoStack = $state<string[][]>([]);
	let selectedColor = $state(PALETTE[9].hex);
	let tool = $state<Tool>('pen');
	let cursor = $state<Cell>({ x: 15, y: 15 });
	let canvasFocused = $state(false);
	let loadedGalleryId = $state<string | null>(null);
	let galleryBusy = $state<string | null>(null);
	let pageVisible = $state(true);
	let status = $state('Blank canvas — draw something, or load a plugin sprite.');

	let strokeActive = false;
	let strokeHasHistory = false;
	let lastStrokeCell: Cell | null = null;

	const filledCount = $derived(pixels.reduce((total, pixel) => total + (pixel ? 1 : 0), 0));
	const hasArtwork = $derived(filledCount > 0);
	const selectedPalette = $derived(
		PALETTE.find((entry) => entry.hex === selectedColor) ?? PALETTE[0]
	);
	const cursorLabel = $derived(
		`${String(cursor.x + 1).padStart(2, '0')}:${String(cursor.y + 1).padStart(2, '0')}`
	);

	function nearestPaletteColor(r: number, g: number, b: number): string {
		let best = PALETTE_RGB[0];
		let bestDistance = Number.POSITIVE_INFINITY;
		for (const entry of PALETTE_RGB) {
			const [pr, pg, pb] = entry.rgb;
			const distance = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
			if (distance < bestDistance) {
				bestDistance = distance;
				best = entry;
			}
		}
		return best.hex;
	}

	function isReviewBackground(r: number, g: number, b: number): boolean {
		return REVIEW_BACKGROUND.some(
			([br, bg, bb]) => (r - br) ** 2 + (g - bg) ** 2 + (b - bb) ** 2 < 20
		);
	}

	function drawPixels(context: CanvasRenderingContext2D, source: string[]) {
		context.clearRect(0, 0, SIZE, SIZE);
		for (let index = 0; index < source.length; index++) {
			const color = source[index];
			if (!color) continue;
			context.fillStyle = color;
			context.fillRect(index % SIZE, Math.floor(index / SIZE), 1, 1);
		}
	}

	$effect(() => {
		const element = canvasEl;
		const currentPixels = pixels;
		if (!element) return;
		const context = element.getContext('2d');
		if (!context) return;
		context.imageSmoothingEnabled = false;
		drawPixels(context, currentPixels);
	});

	// Gallery sprites are pure CSS animation; stop the clock while the tab is hidden.
	$effect(() => {
		const syncVisibility = () => {
			pageVisible = !document.hidden;
		};
		syncVisibility();
		document.addEventListener('visibilitychange', syncVisibility);
		return () => document.removeEventListener('visibilitychange', syncVisibility);
	});

	const motionDuration = (durations: number[]) =>
		durations.reduce((total, duration) => total + duration, 0);

	function pushUndo() {
		const next = [...undoStack, pixels.slice()];
		if (next.length > HISTORY_LIMIT) next.shift();
		undoStack = next;
	}

	function chooseColor(entry: PaletteEntry) {
		selectedColor = entry.hex;
		status = `${entry.name} selected — ${entry.hex}.`;
	}

	function selectTool(nextTool: Tool) {
		tool = nextTool;
		const match = TOOLS.find((entry) => entry.id === nextTool);
		status = match
			? nextTool === 'eyedropper'
				? 'Colour picker selected. Click a drawn pixel to sample it.'
				: `${match.label} selected — ${match.hint}.`
			: '';
	}

	function cellFromEvent(event: PointerEvent): Cell {
		const rect = canvasEl?.getBoundingClientRect();
		if (!rect || rect.width === 0 || rect.height === 0) return cursor;
		const x = Math.min(
			SIZE - 1,
			Math.max(0, Math.floor(((event.clientX - rect.left) / rect.width) * SIZE))
		);
		const y = Math.min(
			SIZE - 1,
			Math.max(0, Math.floor(((event.clientY - rect.top) / rect.height) * SIZE))
		);
		return { x, y };
	}

	function colorAt(cell: Cell): string {
		return pixels[cell.y * SIZE + cell.x] ?? '';
	}

	function pickColorAt(cell: Cell) {
		const color = colorAt(cell);
		if (!color) {
			status = 'That pixel is empty. Nothing to sample.';
			return;
		}
		selectedColor = color;
		if (tool === 'eyedropper') tool = 'pen';
		const entry = PALETTE.find((item) => item.hex === color);
		status = `Picked ${entry?.name ?? color} — ${color}.`;
	}

	function beginStrokeHistory() {
		if (strokeHasHistory) return;
		pushUndo();
		strokeHasHistory = true;
		loadedGalleryId = null;
	}

	function paintCell(cell: Cell, color: string) {
		const index = cell.y * SIZE + cell.x;
		if (pixels[index] === color) return;
		beginStrokeHistory();
		const next = pixels.slice();
		next[index] = color;
		pixels = next;
	}

	function paintLine(from: Cell, to: Cell, color: string) {
		let x0 = from.x;
		let y0 = from.y;
		const x1 = to.x;
		const y1 = to.y;
		const dx = Math.abs(x1 - x0);
		const sx = x0 < x1 ? 1 : -1;
		const dy = -Math.abs(y1 - y0);
		const sy = y0 < y1 ? 1 : -1;
		let error = dx + dy;
		let next: string[] | null = null;

		while (true) {
			const index = y0 * SIZE + x0;
			if (pixels[index] !== color) {
				beginStrokeHistory();
				if (!next) next = pixels.slice();
				next[index] = color;
			}
			if (x0 === x1 && y0 === y1) break;
			const doubled = 2 * error;
			if (doubled >= dy) {
				error += dy;
				x0 += sx;
			}
			if (doubled <= dx) {
				error += dx;
				y0 += sy;
			}
		}

		if (next) pixels = next;
	}

	function startStroke(event: PointerEvent) {
		const cell = cellFromEvent(event);
		cursor = cell;

		if (event.button === 2) {
			event.preventDefault();
			pickColorAt(cell);
			return;
		}
		if (event.button !== 0) return;

		event.preventDefault();
		if (tool === 'eyedropper') {
			pickColorAt(cell);
			return;
		}

		strokeActive = true;
		strokeHasHistory = false;
		lastStrokeCell = cell;
		paintCell(cell, tool === 'eraser' ? '' : selectedColor);

		if (event.pointerType !== 'touch') {
			canvasEl?.focus({ preventScroll: true });
		}
		canvasEl?.setPointerCapture(event.pointerId);
	}

	function moveStroke(event: PointerEvent) {
		const cell = cellFromEvent(event);
		cursor = cell;
		if (!strokeActive || !lastStrokeCell) return;
		if (event.pointerType === 'mouse' && event.buttons === 0) {
			finishStroke(event);
			return;
		}
		paintLine(lastStrokeCell, cell, tool === 'eraser' ? '' : selectedColor);
		lastStrokeCell = cell;
	}

	function finishStroke(event?: PointerEvent) {
		if (!strokeActive) return;
		const didChange = strokeHasHistory;
		strokeActive = false;
		lastStrokeCell = null;
		if (event && canvasEl?.hasPointerCapture(event.pointerId)) {
			canvasEl.releasePointerCapture(event.pointerId);
		}
		strokeHasHistory = false;
		if (didChange) {
			status = tool === 'eraser' ? 'Erased with the stroke.' : 'Painted with the stroke.';
		}
	}

	function keyboardPaint() {
		if (tool === 'eyedropper') {
			pickColorAt(cursor);
			return;
		}
		const color = tool === 'eraser' ? '' : selectedColor;
		const index = cursor.y * SIZE + cursor.x;
		if (pixels[index] === color) {
			status = 'That pixel is unchanged.';
			return;
		}
		pushUndo();
		const next = pixels.slice();
		next[index] = color;
		pixels = next;
		loadedGalleryId = null;
		status = tool === 'eraser' ? `Erased pixel ${cursorLabel}.` : `Painted pixel ${cursorLabel}.`;
	}

	function handleCanvasKeyDown(event: KeyboardEvent) {
		let handled = true;
		let next = cursor;

		switch (event.key) {
			case 'ArrowLeft':
				next = { x: Math.max(0, cursor.x - 1), y: cursor.y };
				break;
			case 'ArrowRight':
				next = { x: Math.min(SIZE - 1, cursor.x + 1), y: cursor.y };
				break;
			case 'ArrowUp':
				next = { x: cursor.x, y: Math.max(0, cursor.y - 1) };
				break;
			case 'ArrowDown':
				next = { x: cursor.x, y: Math.min(SIZE - 1, cursor.y + 1) };
				break;
			case ' ':
			case 'Enter':
				keyboardPaint();
				break;
			case 'Backspace':
			case 'Delete':
				tool = 'eraser';
				keyboardPaint();
				break;
			case 'z':
			case 'Z':
				if (!(event.ctrlKey || event.metaKey)) {
					handled = false;
					break;
				}
				undo();
				break;
			default:
				handled = false;
		}

		if (handled) {
			event.preventDefault();
			cursor = next;
		}
	}

	function focusCanvas() {
		canvasFocused = true;
		status = 'Canvas focused. Arrow keys move the cursor, Space paints.';
	}

	function blurCanvas() {
		canvasFocused = false;
	}

	function undo() {
		if (undoStack.length === 0) return;
		const previous = undoStack[undoStack.length - 1];
		undoStack = undoStack.slice(0, -1);
		pixels = previous;
		loadedGalleryId = null;
		status = 'Last action undone.';
	}

	function clearCanvas() {
		if (!hasArtwork) {
			status = 'Canvas is already empty.';
			return;
		}
		pushUndo();
		pixels = emptyGrid();
		loadedGalleryId = null;
		status = 'Canvas cleared — undo to bring it back.';
	}

	function downloadPng() {
		const exportCanvas = document.createElement('canvas');
		exportCanvas.width = SIZE;
		exportCanvas.height = SIZE;
		const context = exportCanvas.getContext('2d');
		if (!context) {
			status = 'PNG export is not available in this browser.';
			return;
		}
		context.imageSmoothingEnabled = false;
		drawPixels(context, pixels);

		const link = document.createElement('a');
		link.href = exportCanvas.toDataURL('image/png');
		link.download = 'pixel-art-32x32.png';
		document.body.appendChild(link);
		link.click();
		link.remove();
		status = 'Downloaded a 32 × 32 PNG with a transparent background.';
	}

	async function decodeGalleryArt(item: GalleryItem): Promise<string[]> {
		const image = new Image();
		image.decoding = 'async';
		image.src = item.src;
		await image.decode();

		const decodeCanvas = document.createElement('canvas');
		const context = decodeCanvas.getContext('2d', { willReadFrequently: true });
		if (!context) throw new Error('Canvas is unavailable.');

		if (item.decode.kind === 'pixels') {
			decodeCanvas.width = SIZE;
			decodeCanvas.height = SIZE;
			context.imageSmoothingEnabled = false;
			context.drawImage(image, item.decode.x, item.decode.y, SIZE, SIZE, 0, 0, SIZE, SIZE);
			const data = context.getImageData(0, 0, SIZE, SIZE).data;
			const next: string[] = [];
			for (let index = 0; index < SIZE * SIZE; index++) {
				const offset = index * 4;
				if (data[offset + 3] < 24) {
					next.push('');
					continue;
				}
				next.push(nearestPaletteColor(data[offset], data[offset + 1], data[offset + 2]));
			}
			return next;
		}

		decodeCanvas.width = image.naturalWidth;
		decodeCanvas.height = image.naturalHeight;
		context.drawImage(image, 0, 0);
		const data = context.getImageData(0, 0, decodeCanvas.width, decodeCanvas.height).data;
		const next: string[] = [];

		for (let y = 0; y < SIZE; y++) {
			for (let x = 0; x < SIZE; x++) {
				const sourceX = item.decode.x + x * item.decode.step;
				const sourceY = item.decode.y + y * item.decode.step;
				const offset = (sourceY * decodeCanvas.width + sourceX) * 4;
				const r = data[offset];
				const g = data[offset + 1];
				const b = data[offset + 2];
				next.push(isReviewBackground(r, g, b) ? '' : nearestPaletteColor(r, g, b));
			}
		}

		return next;
	}

	async function loadGalleryArt(item: GalleryItem) {
		if (galleryBusy) return;
		galleryBusy = item.id;
		try {
			const decoded = await decodeGalleryArt(item);
			if (!decoded.some(Boolean)) throw new Error('The example decoded to an empty grid.');
			pushUndo();
			pixels = decoded;
			loadedGalleryId = item.id;
			tool = 'pen';
			status = `Loaded ${item.label} into the canvas.`;
		} catch {
			status = 'That example could not be decoded in this browser. Try another.';
		} finally {
			galleryBusy = null;
		}
	}
</script>

<section
	class={`pixel-art-studio mx-auto w-full max-w-[48rem] rounded-2xl border border-white/10 bg-white/5 text-[#f5f4f1] shadow-[0_24px_90px_-40px_rgba(0,0,0,0.9)] backdrop-blur-md ${className}`}
	aria-label="Pixel Art Studio"
>
	<div class="studio-inner">
		<header class="studio-header">
			<div class="eyebrow-row">
				<span class="eyebrow mono">
					<span class="pulse-dot" aria-hidden="true"></span>
					private plugin / live surface
				</span>
				<span class="lock-badge mono">
					<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
						<rect x="5" y="10" width="14" height="10" rx="2"></rect>
						<path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10"></path>
					</svg>
					AI loop closed
				</span>
			</div>
			<div class="title-row">
				<h2>Pixel Art Studio</h2>
				<div class="board-meta mono">
					<span class="board-size">32 × 32</span>
					<span aria-hidden="true">/</span>
					<span>transparent</span>
					<span class="coord-readout" class:is-active={canvasFocused} aria-hidden="true">
						{cursorLabel}
					</span>
				</div>
			</div>
			<p class="lede">
				The model draws, reviews its own pixels, and redraws. Visitors get the exact same surface —
				no prompt required.
			</p>
		</header>

		<div class="studio-body">
			<div class="board-section">
				<div class="canvas-frame">
					<canvas
						bind:this={canvasEl}
						width={SIZE}
						height={SIZE}
						tabindex="0"
						aria-label="32 by 32 pixel drawing canvas. Drag with a mouse or finger to paint. Arrow keys move the cursor and Space paints. Right click samples a colour."
						aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight Space"
						onpointerdown={startStroke}
						onpointermove={moveStroke}
						onpointerup={finishStroke}
						onpointercancel={finishStroke}
						oncontextmenu={(event) => event.preventDefault()}
						onkeydown={handleCanvasKeyDown}
						onfocus={focusCanvas}
						onblur={blurCanvas}
					>
						A 32 by 32 pixel drawing canvas.
					</canvas>
					<div class="pixel-grid" aria-hidden="true"></div>
					{#if canvasFocused}
						<span
							class="cell-cursor"
							style:left={`${(cursor.x / SIZE) * 100}%`}
							style:top={`${(cursor.y / SIZE) * 100}%`}
							aria-hidden="true"
						></span>
					{/if}
				</div>

				<p class="canvas-hint">
					Drag to paint · Right-click to sample · Keyboard: arrows move, Space paints
				</p>
			</div>

			<div class="controls">
				<div class="toolbar" role="toolbar" aria-label="Drawing tools">
					{#each TOOLS as entry (entry.id)}
						<button
							type="button"
							class="tool-button"
							class:is-active={tool === entry.id}
							aria-label={`${entry.label} tool — ${entry.hint}`}
							aria-pressed={tool === entry.id}
							onclick={() => selectTool(entry.id)}
						>
							{#if entry.id === 'pen'}
								<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
									<path d="m14.5 4.5 5 5L8 21H3v-5L14.5 4.5Z"></path>
									<path d="m12.5 6.5 5 5"></path>
								</svg>
							{:else if entry.id === 'eraser'}
								<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
									<path d="m14 4 6 6-8 8H6l-2-2 10-12Z"></path>
									<path d="m8 14 6 6"></path>
									<path d="M10 20h10"></path>
								</svg>
							{:else}
								<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
									<path d="m19 5 3 3-9 9-4 1 1-4 9-9Z"></path>
									<path d="M4 21h4"></path>
								</svg>
							{/if}
							<span>{entry.label}</span>
						</button>
					{/each}
				</div>

				<div class="color-block">
					<div class="color-header mono">
						<span>palette</span>
						<span class="current-color">
							{selectedPalette.name}
							<span>{selectedPalette.hex}</span>
						</span>
					</div>
					<div class="palette" role="group" aria-label="Colour palette">
						{#each PALETTE as entry (entry.hex)}
							<button
								type="button"
								class="swatch"
								class:is-selected={selectedColor === entry.hex}
								style={`--swatch:${entry.hex};--swatch-ink:${entry.ink};`}
								aria-label={`${entry.name} ${entry.hex}`}
								aria-pressed={selectedColor === entry.hex}
								title={`${entry.name} ${entry.hex}`}
								onclick={() => chooseColor(entry)}
							>
								{#if selectedColor === entry.hex}
									<svg
										class="swatch-check"
										viewBox="0 0 24 24"
										aria-hidden="true"
										focusable="false"
									>
										<path d="m5 12 4 4L19 6"></path>
									</svg>
								{/if}
							</button>
						{/each}
					</div>
				</div>

				<div class="actions">
					<button
						type="button"
						class="secondary-button"
						onclick={undo}
						disabled={undoStack.length === 0}
						aria-label="Undo last action"
					>
						<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
							<path d="M9 7 4 12l5 5"></path>
							<path d="M4 12h10a6 6 0 0 1 0 12"></path>
						</svg>
						Undo
					</button>
					<button
						type="button"
						class="secondary-button"
						onclick={clearCanvas}
						disabled={!hasArtwork}
						aria-label="Clear canvas"
					>
						<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
							<path d="M4 7h16"></path>
							<path d="M9 7V4h6v3"></path>
							<path d="m7 7 1 13h8l1-13"></path>
						</svg>
						Clear
					</button>
					<button
						type="button"
						class="download-button"
						onclick={downloadPng}
						aria-label="Download PNG — the current 32 by 32 drawing"
					>
						<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
							<path d="M12 3v12"></path>
							<path d="m7 10 5 5 5-5"></path>
							<path d="M4 19h16"></path>
						</svg>
						Download PNG
					</button>
				</div>
			</div>
		</div>

		<section class="gallery" aria-label="Example sprites drawn by the plugin">
			<div class="gallery-header">
				<h3 class="mono">plugin output</h3>
				<span class="mono">click to load →</span>
			</div>
			<div class="gallery-strip">
				{#each GALLERY as item (item.id)}
					<button
						type="button"
						class="gallery-item"
						class:is-loaded={loadedGalleryId === item.id}
						class:gallery-item--wide={item.id === 'review'}
						data-gallery={item.id}
						aria-label={`Load ${item.label}, ${item.meta}, into the editor`}
						aria-pressed={loadedGalleryId === item.id}
						aria-busy={galleryBusy === item.id}
						disabled={galleryBusy !== null && galleryBusy !== item.id}
						onclick={() => loadGalleryArt(item)}
					>
						<span class="gallery-thumb">
							{#if item.motion?.kind === 'strip'}
								<span class="sprite-window" aria-hidden="true">
									<img
										class="sprite-strip"
										class:sprite-even={item.motion.preset === 'even'}
										class:sprite-blink={item.motion.preset === 'blink'}
										class:is-paused={!pageVisible}
										src={item.src}
										alt=""
										draggable="false"
										decoding="async"
										style={`--frames:${item.motion.frames};--duration:${motionDuration(
											item.motion.durations
										)}ms;`}
									/>
								</span>
							{:else if item.motion?.kind === 'bob'}
								<img
									class="sprite-bob"
									class:is-paused={!pageVisible}
									src={item.src}
									alt=""
									draggable="false"
									decoding="async"
									style={`--duration:${item.motion.duration}ms;`}
								/>
							{:else}
								<img src={item.src} alt="" draggable="false" decoding="async" />
							{/if}
						</span>
						<span class="gallery-copy">
							<span class="gallery-label">{item.label}</span>
							<span class="gallery-meta mono"
								>{galleryBusy === item.id ? 'loading…' : item.meta}</span
							>
						</span>
					</button>
				{/each}
			</div>
		</section>

		<footer class="studio-footer">
			<p class="status-line" aria-live="polite">{status}</p>
			<p class="privacy-line mono">surface only · local state</p>
		</footer>
	</div>
</section>

<style>
	.pixel-art-studio {
		position: relative;
		isolation: isolate;
		container-type: inline-size;
		container-name: studio;
		background-image:
			radial-gradient(90% 50% at 50% -10%, rgba(167, 139, 250, 0.14), transparent 70%),
			radial-gradient(50% 40% at 100% 20%, rgba(245, 184, 75, 0.07), transparent 75%);
		box-shadow:
			0 24px 90px -40px rgba(0, 0, 0, 0.9),
			inset 0 1px 0 rgba(255, 255, 255, 0.08);
	}

	.studio-inner {
		padding: clamp(0.9rem, 3.5vw, 1.35rem);
	}

	.studio-header {
		margin-bottom: 1rem;
	}

	.title-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 0.35rem 0.9rem;
	}

	.title-row h2 {
		min-width: 0;
	}

	.eyebrow-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		margin-bottom: 0.7rem;
	}

	.mono {
		font-family: 'Courier Prime', ui-monospace, 'Cascadia Code', monospace;
	}

	.eyebrow {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		min-width: 0;
		color: rgba(245, 244, 241, 0.58);
		font-size: 0.61rem;
		letter-spacing: 0.13em;
		text-transform: uppercase;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.pulse-dot {
		width: 0.38rem;
		height: 0.38rem;
		flex: none;
		border-radius: 999px;
		background: #f5b84b;
		box-shadow: 0 0 10px rgba(245, 184, 75, 0.8);
	}

	.lock-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		flex: none;
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 999px;
		padding: 0.2rem 0.5rem;
		color: rgba(245, 244, 241, 0.58);
		font-size: 0.58rem;
		letter-spacing: 0.07em;
		text-transform: uppercase;
	}

	.lock-badge svg {
		width: 0.72rem;
		height: 0.72rem;
		fill: none;
		stroke: #a78bfa;
		stroke-width: 1.8;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	h2 {
		margin: 0;
		font-size: clamp(1.25rem, 4vw, 1.45rem);
		font-weight: 600;
		line-height: 1.2;
		letter-spacing: -0.03em;
	}

	.lede {
		margin: 0.45rem 0 0;
		color: rgba(245, 244, 241, 0.62);
		font-size: 0.79rem;
		line-height: 1.55;
	}

	.board-section {
		margin: 0.9rem 0 1rem;
	}

	.board-meta {
		display: flex;
		align-items: center;
		gap: 0.38rem;
		margin: 0;
		color: rgba(245, 244, 241, 0.46);
		font-size: 0.62rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		white-space: nowrap;
	}

	.board-size {
		color: rgba(245, 244, 241, 0.82);
	}

	.coord-readout {
		margin-left: auto;
		color: rgba(245, 244, 241, 0.26);
		transition: color 180ms ease;
	}

	.coord-readout.is-active {
		color: #f5b84b;
	}

	.canvas-frame {
		position: relative;
		/* 22rem + the two 1px borders keeps the 32px bitmap at exactly 11x. */
		width: min(100%, calc(22rem + 2px));
		margin-inline: auto;
		aspect-ratio: 1;
		border: 1px solid rgba(255, 255, 255, 0.13);
		border-radius: 0.5rem;
		background-color: #090a11;
		box-shadow:
			0 0 0 1px rgba(0, 0, 0, 0.38),
			0 16px 45px -26px rgba(0, 0, 0, 0.95),
			inset 0 0 32px rgba(167, 139, 250, 0.035);
	}

	.canvas-frame:focus-within {
		border-color: rgba(167, 139, 250, 0.7);
		box-shadow:
			0 0 0 1px rgba(167, 139, 250, 0.25),
			0 0 30px rgba(91, 63, 168, 0.25),
			inset 0 0 32px rgba(167, 139, 250, 0.035);
	}

	canvas {
		display: block;
		width: 100%;
		height: 100%;
		border-radius: 0.45rem;
		image-rendering: pixelated;
		-ms-interpolation-mode: nearest-neighbor;
		touch-action: none;
		cursor: crosshair;
		outline: none;
		-webkit-touch-callout: none;
		user-select: none;
	}

	canvas:focus-visible {
		outline: 2px solid #a78bfa;
		outline-offset: 3px;
	}

	.pixel-grid {
		position: absolute;
		inset: 0;
		border-radius: inherit;
		pointer-events: none;
		background-image:
			linear-gradient(to right, rgba(245, 244, 241, 0.055) 1px, transparent 1px),
			linear-gradient(to bottom, rgba(245, 244, 241, 0.055) 1px, transparent 1px);
		background-size: calc(100% / 32) calc(100% / 32);
	}

	.cell-cursor {
		position: absolute;
		left: 0;
		top: 0;
		width: calc(100% / 32);
		height: calc(100% / 32);
		pointer-events: none;
		border: 1px solid rgba(245, 244, 241, 0.92);
		box-shadow:
			0 0 0 1px rgba(9, 10, 17, 0.8),
			0 0 10px rgba(167, 139, 250, 0.5);
		z-index: 2;
	}

	.canvas-hint {
		margin: 0.5rem 0 0;
		color: rgba(245, 244, 241, 0.34);
		font-size: 0.65rem;
		line-height: 1.4;
		text-align: center;
	}

	.controls {
		padding-top: 0.9rem;
		border-top: 1px solid rgba(255, 255, 255, 0.08);
	}

	.toolbar {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.4rem;
	}

	.tool-button,
	.secondary-button,
	.download-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border: 1px solid transparent;
		font: inherit;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
	}

	.tool-button {
		min-height: 2.55rem;
		gap: 0.38rem;
		padding: 0.35rem 0.5rem;
		border-color: rgba(255, 255, 255, 0.09);
		border-radius: 0.45rem;
		background: rgba(255, 255, 255, 0.025);
		color: rgba(245, 244, 241, 0.6);
		font-size: 0.73rem;
		transition:
			color 150ms ease,
			border-color 150ms ease,
			background-color 150ms ease;
	}

	.tool-button:hover {
		color: #f5f4f1;
		background: rgba(255, 255, 255, 0.06);
	}

	.tool-button.is-active {
		color: #f5f4f1;
		border-color: rgba(167, 139, 250, 0.58);
		background: rgba(167, 139, 250, 0.14);
	}

	.tool-button svg,
	.secondary-button svg,
	.download-button svg {
		width: 0.92rem;
		height: 0.92rem;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.7;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.color-block {
		margin-top: 0.85rem;
	}

	.color-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		margin-bottom: 0.4rem;
		color: rgba(245, 244, 241, 0.36);
		font-size: 0.59rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.current-color {
		color: rgba(245, 244, 241, 0.74);
		letter-spacing: 0.02em;
		text-transform: none;
	}

	.current-color span {
		margin-left: 0.3rem;
		color: rgba(245, 244, 241, 0.36);
	}

	.palette {
		display: grid;
		grid-template-columns: repeat(6, minmax(0, 1fr));
		gap: 0.35rem;
	}

	.swatch {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		height: 2.25rem;
		border: 1px solid rgba(255, 255, 255, 0.14);
		border-radius: 0.38rem;
		background: var(--swatch);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.13);
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
		transition:
			transform 140ms ease,
			box-shadow 140ms ease,
			border-color 140ms ease;
	}

	.swatch:hover {
		transform: translateY(-1px);
		border-color: rgba(255, 255, 255, 0.34);
	}

	.swatch.is-selected {
		border-color: #f5f4f1;
		box-shadow:
			0 0 0 2px #090a11,
			0 0 0 3px rgba(167, 139, 250, 0.9),
			0 0 18px rgba(167, 139, 250, 0.3);
	}

	.swatch-check {
		width: 0.9rem;
		height: 0.9rem;
		fill: none;
		stroke: var(--swatch-ink);
		stroke-width: 2.7;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.actions {
		display: flex;
		gap: 0.4rem;
		margin-top: 0.85rem;
	}

	.secondary-button,
	.download-button {
		min-height: 2.55rem;
		border-radius: 0.45rem;
		font-size: 0.72rem;
		white-space: nowrap;
		transition:
			background-color 150ms ease,
			color 150ms ease,
			opacity 150ms ease;
	}

	.secondary-button {
		flex: 0 0 auto;
		gap: 0.32rem;
		padding: 0.35rem 0.65rem;
		border-color: rgba(255, 255, 255, 0.09);
		background: transparent;
		color: rgba(245, 244, 241, 0.62);
	}

	.secondary-button:hover:not(:disabled) {
		background: rgba(255, 255, 255, 0.06);
		color: #f5f4f1;
	}

	.secondary-button:disabled {
		cursor: not-allowed;
		opacity: 0.32;
	}

	.download-button {
		flex: 1 1 auto;
		gap: 0.4rem;
		padding: 0.35rem 0.8rem;
		border-color: rgba(245, 244, 241, 0.8);
		background: #f5f4f1;
		color: #14141c;
		font-weight: 600;
	}

	.download-button:hover {
		background: #ffffff;
	}

	.tool-button:focus-visible,
	.secondary-button:focus-visible,
	.download-button:focus-visible,
	.swatch:focus-visible,
	.gallery-item:focus-visible {
		outline: 2px solid #a78bfa;
		outline-offset: 2px;
	}

	.gallery {
		margin-top: 1rem;
		padding-top: 0.9rem;
		border-top: 1px solid rgba(255, 255, 255, 0.08);
	}

	.gallery-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.45rem;
		color: rgba(245, 244, 241, 0.3);
		font-size: 0.58rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.gallery-header h3 {
		margin: 0;
		font-size: inherit;
		font-weight: 400;
	}

	.gallery-strip {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.4rem;
	}

	.gallery-item--wide {
		grid-column: span 2;
	}

	.gallery-item {
		display: flex;
		flex-direction: column;
		align-items: stretch;
		min-width: 0;
		padding: 0;
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 0.45rem;
		background: rgba(0, 0, 0, 0.16);
		color: rgba(245, 244, 241, 0.7);
		font: inherit;
		text-align: left;
		cursor: pointer;
		overflow: hidden;
		transition:
			border-color 150ms ease,
			background-color 150ms ease,
			opacity 150ms ease;
	}

	.gallery-item:hover:not(:disabled) {
		border-color: rgba(167, 139, 250, 0.42);
		background: rgba(167, 139, 250, 0.08);
	}

	.gallery-item.is-loaded {
		border-color: rgba(245, 184, 75, 0.55);
		background: rgba(245, 184, 75, 0.06);
	}

	.gallery-item:disabled {
		cursor: wait;
		opacity: 0.55;
	}

	.gallery-thumb {
		--thumb: 4rem;
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 4.75rem;
		padding: 0.4rem;
		background-image:
			linear-gradient(45deg, rgba(255, 255, 255, 0.028) 25%, transparent 25%),
			linear-gradient(-45deg, rgba(255, 255, 255, 0.028) 25%, transparent 25%),
			linear-gradient(45deg, transparent 75%, rgba(255, 255, 255, 0.028) 75%),
			linear-gradient(-45deg, transparent 75%, rgba(255, 255, 255, 0.028) 75%);
		background-size: 12px 12px;
		background-position:
			0 0,
			0 6px,
			6px -6px,
			-6px 0;
	}

	.gallery-thumb img {
		display: block;
		max-width: 100%;
		max-height: 2.75rem;
		height: auto;
		width: auto;
		image-rendering: pixelated;
	}

	.gallery-item--wide .gallery-thumb img {
		max-height: 3.25rem;
	}

	/* Animated examples: 32px frames shown at exactly 2x (64px). */
	.sprite-window {
		display: block;
		width: var(--thumb);
		height: var(--thumb);
		overflow: hidden;
		image-rendering: pixelated;
	}

	.gallery-thumb .sprite-strip {
		display: block;
		width: calc(var(--thumb) * var(--frames));
		height: var(--thumb);
		max-width: none;
		max-height: none;
		image-rendering: pixelated;
		animation-duration: var(--duration);
		animation-iteration-count: infinite;
	}

	.gallery-thumb .sprite-strip.sprite-even {
		animation-name: sprite-even;
		animation-timing-function: steps(4);
	}

	.gallery-thumb .sprite-strip.sprite-blink {
		animation-name: sprite-blink;
		animation-timing-function: step-end;
	}

	.gallery-thumb .sprite-bob {
		width: var(--thumb);
		height: var(--thumb);
		max-width: none;
		max-height: none;
		image-rendering: pixelated;
		animation: sprite-bob var(--duration) step-end infinite;
	}

	.gallery-thumb .sprite-strip.is-paused,
	.gallery-thumb .sprite-bob.is-paused {
		animation-play-state: paused;
	}

	@keyframes sprite-even {
		from {
			transform: translateX(0);
		}
		to {
			transform: translateX(calc(var(--thumb) * -4));
		}
	}

	@keyframes sprite-blink {
		0% {
			transform: translateX(0);
		}
		77.59% {
			transform: translateX(calc(var(--thumb) * -1));
		}
		87.94% {
			transform: translateX(calc(var(--thumb) * -2));
		}
		100% {
			transform: translateX(calc(var(--thumb) * -2));
		}
	}

	@keyframes sprite-bob {
		0% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(calc(var(--thumb) * -1 / 32));
		}
		100% {
			transform: translateY(calc(var(--thumb) * -1 / 32));
		}
	}

	.gallery-copy {
		display: block;
		min-width: 0;
	}

	.gallery-label {
		display: block;
		padding: 0.35rem 0.45rem 0;
		font-size: 0.65rem;
		line-height: 1.25;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.gallery-meta {
		display: block;
		padding: 0.05rem 0.45rem 0.4rem;
		color: rgba(245, 244, 241, 0.3);
		font-size: 0.52rem;
		letter-spacing: 0.04em;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.studio-footer {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.75rem;
		margin-top: 0.85rem;
		padding-top: 0.8rem;
		border-top: 1px solid rgba(255, 255, 255, 0.08);
	}

	.status-line {
		margin: 0;
		color: rgba(245, 244, 241, 0.43);
		font-size: 0.65rem;
		line-height: 1.4;
	}

	.privacy-line {
		flex: none;
		margin: 0;
		color: rgba(245, 244, 241, 0.23);
		font-size: 0.54rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		white-space: nowrap;
	}

	/*
	 * Wide studio: once the card itself has room (not just the viewport), the
	 * canvas sits on the left, the tools/palette/actions stack on the right and
	 * the five examples share one row underneath. Container queries keep the
	 * vertical stack when the card is placed in a narrow column.
	 */
	@container studio (min-width: 718px) {
		/* 718px is a 720px card minus the 2px border: the query box is the content box. */
		.studio-header {
			margin-bottom: 0.8rem;
		}

		.eyebrow-row {
			margin-bottom: 0.45rem;
		}

		.lede {
			margin-top: 0.3rem;
			font-size: 0.72rem;
			line-height: 1.45;
		}

		.studio-body {
			display: grid;
			grid-template-columns: minmax(0, 258px) minmax(0, 1fr);
			gap: 1.25rem;
			align-items: start;
		}

		.board-section {
			margin: 0;
		}

		.canvas-frame {
			/* 16rem = 8× the 32px bitmap, plus the two 1px borders. */
			width: 100%;
			max-width: calc(16rem + 2px);
			margin-inline: 0;
		}

		.canvas-hint {
			margin-top: 0.4rem;
			font-size: 0.6rem;
			line-height: 1.35;
			text-align: left;
		}

		.controls {
			padding-top: 0;
			border-top: 0;
		}

		.tool-button {
			min-height: 2.25rem;
		}

		.color-block {
			margin-top: 0.7rem;
		}

		.color-header {
			margin-bottom: 0.3rem;
		}

		.swatch {
			height: 1.9rem;
		}

		.actions {
			margin-top: 0.7rem;
		}

		.secondary-button,
		.download-button {
			min-height: 2.25rem;
		}

		.gallery {
			margin-top: 0.8rem;
			padding-top: 0.6rem;
		}

		.gallery-header {
			margin-bottom: 0.4rem;
		}

		.gallery-strip {
			display: flex;
			gap: 0.35rem;
		}

		.gallery-item {
			flex: 1 1 0;
			flex-direction: row;
			align-items: center;
			gap: 0.45rem;
			padding: 0.25rem 0.3rem;
		}

		.gallery-item--wide {
			flex: 1.55 1 0;
			grid-column: auto;
		}

		.gallery-thumb {
			--thumb: 2rem;
			flex: none;
			width: auto;
			min-height: 0;
			padding: 0.15rem;
		}

		.gallery-thumb img {
			max-height: 2rem;
		}

		.gallery-item--wide .gallery-thumb img {
			max-height: 2rem;
		}

		.gallery-copy {
			flex: 1 1 auto;
		}

		.gallery-label {
			padding: 0;
			font-size: 0.6rem;
			line-height: 1.15;
			white-space: normal;
			overflow: visible;
			text-overflow: clip;
		}

		.gallery-meta {
			padding: 0.05rem 0 0;
			font-size: 0.46rem;
			line-height: 1.2;
			white-space: normal;
			overflow: visible;
			text-overflow: clip;
		}

		.studio-footer {
			margin-top: 0.7rem;
			padding-top: 0.6rem;
		}
	}

	@media (max-width: 24rem) {
		.eyebrow-row {
			align-items: flex-start;
			flex-direction: column;
			gap: 0.45rem;
		}

		.lock-badge {
			align-self: flex-end;
		}

		.actions {
			flex-wrap: wrap;
		}

		.download-button {
			flex-basis: 100%;
			order: 3;
		}
	}

	@media (max-width: 20rem) {
		.gallery-strip {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.gallery-item--wide {
			grid-column: 1 / -1;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.pixel-art-studio *,
		.pixel-art-studio *::before,
		.pixel-art-studio *::after {
			scroll-behavior: auto !important;
			transition-duration: 0.001ms !important;
			animation-duration: 0.001ms !important;
			animation-iteration-count: 1 !important;
		}

		/* Show the first frame, no loop. */
		.gallery-thumb .sprite-strip,
		.gallery-thumb .sprite-bob {
			animation: none !important;
			transform: none !important;
		}

		.swatch:hover {
			transform: none;
		}
	}
</style>
