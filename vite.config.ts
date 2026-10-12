import { defineConfig } from 'vitest/config';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';

const base = (process.env.BASE_PATH ??
  (process.env.NODE_ENV === 'production' ? '/volscore' : '')) as '' | `/${string}`;

export default defineConfig({
  plugins: [
    sveltekit({
      adapter: adapter({ fallback: '404.html' }),
      compilerOptions: { runes: true },
      paths: { base }
    })
  ],
  test: {
    expect: { requireAssertions: true },
    include: ['src/**/*.{test,spec}.{js,ts}']
  }
});
