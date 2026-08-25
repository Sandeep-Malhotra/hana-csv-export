import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'hana-blue': '#0070F3',
        'hana-dark': '#0A0A0A',
        'hana-card': '#111111',
        'hana-border': '#222222',
        'hana-muted': '#888888',
      },
    },
  },
  plugins: [],
};

export default config;
