import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import modScanner from './src/lib/extractor';

export default defineConfig({
	plugins: [modScanner(), tailwindcss(), sveltekit()]
});
