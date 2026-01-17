<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';

	interface Props {
		enableStars?: boolean;
		enableClouds?: boolean;
		enableParticles?: boolean;
		enableAurora?: boolean;
		starCount?: number;
		particleCount?: number;
		cloudCount?: number;
	}

	let {
		enableStars = true,
		enableClouds = false,
		enableParticles = true,
		enableAurora = true,
		starCount = 50,
		particleCount = 30,
		cloudCount = 5
	}: Props = $props();

	let container: HTMLDivElement;
	let mouseX = 0;
	let mouseY = 0;
	let stars = $state<Array<{ x: number; y: number; vx: number; vy: number; size: number; opacity: number; twinkleSpeed: number; mouseGlow: number; baseX: number; baseY: number }>>([]);
	let particles = $state<Array<{ x: number; y: number; vx: number; vy: number; size: number; opacity: number }>>([]);
	let clouds = $state<Array<{ x: number; y: number; size: number; speed: number; opacity: number }>>([]);
	let initialized = $state(false);
	let auroraOffset = $state({ x: 50, y: 30 });
	let animationFrameId: number | null = null;
	let auroraTime = $state(0);

	const handleMouseMove = (e: MouseEvent) => {
		if (!container) return;
		const rect = container.getBoundingClientRect();
		mouseX = e.clientX - rect.left;
		mouseY = e.clientY - rect.top;

		// Update aurora to follow mouse (smoothly)
		if (enableAurora) {
			const targetX = (mouseX / rect.width) * 100;
			const targetY = (mouseY / rect.height) * 100;
			auroraOffset.x += (targetX - auroraOffset.x) * 0.05;
			auroraOffset.y += (targetY - auroraOffset.y) * 0.05;
		}

		// Update particles to follow mouse
		if (enableParticles) {
			particles.forEach((particle, i) => {
				const dx = mouseX - particle.x;
				const dy = mouseY - particle.y;
				const distance = Math.sqrt(dx * dx + dy * dy);
				const maxDistance = 200;

				if (distance < maxDistance) {
					const force = (maxDistance - distance) / maxDistance;
					particle.vx += (dx / distance) * force * 0.1;
					particle.vy += (dy / distance) * force * 0.1;
				}

				// Apply friction
				particle.vx *= 0.95;
				particle.vy *= 0.95;
			});
		}
	};

	const initStars = () => {
		if (!container) return;
		const width = container.offsetWidth || window.innerWidth;
		const height = container.offsetHeight || window.innerHeight;
		stars = Array.from({ length: starCount }, () => {
			const baseX = Math.random() * width;
			const baseY = Math.random() * height;
			return {
				x: baseX,
				y: baseY,
				vx: 0,
				vy: 0,
				size: Math.random() * 3 + 1.5,
				opacity: Math.random() * 0.4 + 0.6,
				twinkleSpeed: Math.random() * 0.02 + 0.01,
				mouseGlow: 0,
				baseX,
				baseY
			};
		});
	};

	const initParticles = () => {
		if (!container) return;
		const width = container.offsetWidth || window.innerWidth;
		const height = container.offsetHeight || window.innerHeight;
		particles = Array.from({ length: particleCount }, () => ({
			x: Math.random() * width,
			y: Math.random() * height,
			vx: (Math.random() - 0.5) * 0.5,
			vy: (Math.random() - 0.5) * 0.5,
			size: Math.random() * 4 + 2,
			opacity: Math.random() * 0.3 + 0.5
		}));
	};

	const initClouds = () => {
		if (!container) return;
		const width = container.offsetWidth || window.innerWidth;
		const height = container.offsetHeight || window.innerHeight;
		clouds = Array.from({ length: cloudCount }, () => ({
			x: Math.random() * width,
			y: Math.random() * (height * 0.6),
			size: Math.random() * 200 + 150,
			speed: Math.random() * 0.2 + 0.1,
			opacity: Math.random() * 0.2 + 0.2
		}));
	};

	const animate = () => {
		if (!container) return;

		// Animate aurora time
		if (enableAurora) {
			auroraTime += 0.01;
		}

		// Animate stars (twinkling and mouse interaction)
		if (enableStars) {
			stars.forEach((star) => {
				// Check mouse proximity for repulsion
				const dx = mouseX - star.x;
				const dy = mouseY - star.y;
				const distance = Math.sqrt(dx * dx + dy * dy);
				const repulsionDistance = 100;
				const maxDistance = 120;
				
				if (distance < repulsionDistance && distance > 0) {
					// Repel from mouse (like magnets)
					const force = (repulsionDistance - distance) / repulsionDistance;
					const angle = Math.atan2(dy, dx);
					
					// Apply repulsion force (opposite direction from mouse)
					star.vx += Math.cos(angle + Math.PI) * force * 0.8;
					star.vy += Math.sin(angle + Math.PI) * force * 0.8;
					
					// Increase glow when mouse is near
					const proximity = 1 - (distance / maxDistance);
					star.mouseGlow += (proximity * 0.5 - star.mouseGlow) * 0.2;
				} else {
					// Fade glow when mouse is far
					star.mouseGlow += (0 - star.mouseGlow) * 0.1;
					
					// Return to base position (spring-like behavior)
					const returnForce = 0.05;
					star.vx += (star.baseX - star.x) * returnForce;
					star.vy += (star.baseY - star.y) * returnForce;
				}
				
				// Apply damping/friction
				star.vx *= 0.92;
				star.vy *= 0.92;
				
				// Update position
				star.x += star.vx;
				star.y += star.vy;
				
				// Normal twinkling animation
				star.opacity += star.twinkleSpeed;
				if (star.opacity > 0.8 || star.opacity < 0.3) {
					star.twinkleSpeed *= -1;
				}
			});
		}

		// Animate particles
		if (enableParticles) {
			particles.forEach((particle) => {
				particle.x += particle.vx;
				particle.y += particle.vy;

				// Wrap around edges
				if (particle.x < 0) particle.x = container.offsetWidth;
				if (particle.x > container.offsetWidth) particle.x = 0;
				if (particle.y < 0) particle.y = container.offsetHeight;
				if (particle.y > container.offsetHeight) particle.y = 0;

				// React to mouse proximity
				const dx = mouseX - particle.x;
				const dy = mouseY - particle.y;
				const distance = Math.sqrt(dx * dx + dy * dy);
				const maxDistance = 150;

				if (distance < maxDistance) {
					const force = (maxDistance - distance) / maxDistance;
					particle.vx += (dx / distance) * force * 0.05;
					particle.vy += (dy / distance) * force * 0.05;
				}

				// Apply friction
				particle.vx *= 0.98;
				particle.vy *= 0.98;
			});
		}

		// Animate clouds
		if (enableClouds) {
			clouds.forEach((cloud) => {
				cloud.x += cloud.speed;
				if (cloud.x > container.offsetWidth + cloud.size) {
					cloud.x = -cloud.size;
				}

				// Slight vertical movement
				cloud.y += Math.sin(cloud.x * 0.01) * 0.1;
			});
		}

		animationFrameId = requestAnimationFrame(animate);
	};

	onMount(() => {
		if (!browser) return;

		// Wait for container to be properly sized
		const initTimeout = setTimeout(() => {
			initStars();
			initParticles();
			initClouds();
			initialized = true;
		}, 100);

		const handleResize = () => {
			if (initialized) {
				initStars();
				initParticles();
				initClouds();
			}
		};

		container.addEventListener('mousemove', handleMouseMove);
		window.addEventListener('resize', handleResize);
		animate();

		return () => {
			clearTimeout(initTimeout);
			container?.removeEventListener('mousemove', handleMouseMove);
			window.removeEventListener('resize', handleResize);
			if (animationFrameId !== null) {
				cancelAnimationFrame(animationFrameId);
			}
		};
	});

	onDestroy(() => {
		if (animationFrameId !== null) {
			cancelAnimationFrame(animationFrameId);
		}
	});
</script>

<div bind:this={container} class="interactive-background" aria-hidden="true">
	{#if enableAurora}
		<div
			class="aurora-layer"
			style="--aurora-x: {auroraOffset.x}%; --aurora-y: {auroraOffset.y}%; --aurora-time: {auroraTime};"
		></div>
	{/if}

	{#if enableStars}
		<div class="stars-layer">
		{#each stars as star (star)}
			<div
				class="star"
				style="left: {star.x}px; top: {star.y}px; width: {star.size}px; height: {star.size}px; opacity: {Math.min(1, star.opacity + star.mouseGlow)}; --glow-intensity: {star.mouseGlow};"
			></div>
		{/each}
		</div>
	{/if}

	{#if enableClouds}
		<div class="clouds-layer">
			{#each clouds as cloud (cloud)}
				<div
					class="cloud"
					style="left: {cloud.x}px; top: {cloud.y}px; width: {cloud.size}px; height: {cloud.size * 0.6}px; opacity: {cloud.opacity};"
				></div>
			{/each}
		</div>
	{/if}

	{#if enableParticles}
		<div class="particles-layer">
			{#each particles as particle (particle)}
				<div
					class="particle"
					style="left: {particle.x}px; top: {particle.y}px; width: {particle.size}px; height: {particle.size}px; opacity: {particle.opacity};"
				></div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.interactive-background {
		position: fixed;
		inset: 0;
		overflow: hidden;
		z-index: 1;
		pointer-events: auto;
	}

	.aurora-layer {
		position: absolute;
		inset: 0;
		background: 
			radial-gradient(
				ellipse 80% 50% at var(--aurora-x, 50%) var(--aurora-y, 30%),
				rgba(219, 39, 119, 0.15) 0%,
				rgba(168, 85, 247, 0.12) 30%,
				rgba(139, 92, 246, 0.08) 50%,
				transparent 70%
			),
			radial-gradient(
				ellipse 60% 40% at calc(var(--aurora-x, 50%) + 20%) calc(var(--aurora-y, 30%) + 10%),
				rgba(236, 72, 153, 0.12) 0%,
				rgba(192, 132, 252, 0.1) 40%,
				transparent 70%
			);
		filter: blur(60px);
		animation: aurora-wave 20s ease-in-out infinite;
		opacity: 0.8;
		pointer-events: none;
	}

	@keyframes aurora-wave {
		0%,
		100% {
			transform: translateY(0) scaleY(1);
		}
		50% {
			transform: translateY(-30px) scaleY(1.1);
		}
	}

	.stars-layer {
		position: absolute;
		inset: 0;
	}

	.star {
		position: absolute;
		background: radial-gradient(circle, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 0.7) 40%, transparent 80%);
		border-radius: 50%;
		transform: translate(-50%, -50%) scale(calc(1 + var(--glow-intensity, 0) * 0.3));
		transition: opacity 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
		box-shadow: 
			0 0 calc(8px + var(--glow-intensity, 0) * 12px) rgba(255, 255, 255, calc(0.9 + var(--glow-intensity, 0) * 0.3)),
			0 0 calc(16px + var(--glow-intensity, 0) * 20px) rgba(219, 39, 119, calc(0.3 + var(--glow-intensity, 0) * 0.4)),
			0 0 calc(24px + var(--glow-intensity, 0) * 30px) rgba(168, 85, 247, calc(0.2 + var(--glow-intensity, 0) * 0.3));
		pointer-events: none;
	}

	.clouds-layer {
		position: absolute;
		inset: 0;
	}

	.cloud {
		position: absolute;
		background: radial-gradient(
			ellipse at center,
			rgba(255, 255, 255, 0.6) 0%,
			rgba(255, 255, 255, 0.4) 40%,
			rgba(186, 230, 253, 0.2) 70%,
			transparent 100%
		);
		border-radius: 50%;
		filter: blur(50px);
		transform: translate(-50%, -50%);
		animation: cloud-float 20s ease-in-out infinite;
		pointer-events: none;
	}

	@keyframes cloud-float {
		0%,
		100% {
			transform: translate(-50%, -50%) translateY(0);
		}
		50% {
			transform: translate(-50%, -50%) translateY(-20px);
		}
	}

	.particles-layer {
		position: absolute;
		inset: 0;
	}

	.particle {
		position: absolute;
		background: radial-gradient(circle, rgba(255, 255, 255, 0.7) 0%, rgba(219, 39, 119, 0.4) 30%, rgba(168, 85, 247, 0.3) 50%, transparent 80%);
		border-radius: 50%;
		transform: translate(-50%, -50%);
		box-shadow: 0 0 12px rgba(219, 39, 119, 0.5), 0 0 24px rgba(168, 85, 247, 0.3);
		transition: transform 0.1s ease-out;
		pointer-events: none;
	}
</style>