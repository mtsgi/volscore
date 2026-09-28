import adapter from '@sveltejs/adapter-static';

const config = {
  compilerOptions: { runes: true },
  kit: {
    adapter: adapter({ fallback: '404.html' }),
    paths: {
      base: process.env.BASE_PATH ?? (process.env.NODE_ENV === 'production' ? '/volscore' : '')
    }
  }
};

export default config;
