import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}', '../../apps/web/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Medical blue — trust
        blue: {
          900: '#14375f',
          800: '#1a4577',
          700: '#1e5290',
          600: '#2563a8',
          500: '#3a7cc0',
          200: '#b9d2ea',
          100: '#dce8f4',
          50: '#eef4fa',
        },
        // Warm neutrals — human
        bg: { DEFAULT: '#faf6f0', 2: '#f4ede2' },
        surface: '#ffffff',
        warm: { 100: '#f3ece1', 200: '#e8dccb' },
        line: { DEFAULT: '#e7ddcf', 2: '#d8cbb6' },
        // Warm ink
        ink: { DEFAULT: '#2c2820', 2: '#5b5347', 3: '#8a8073' },
        // Accents
        terra: { DEFAULT: '#c06a38', 50: '#f8ece3' },
        green: { DEFAULT: '#2f8a64', 50: '#e6f2ec' },
        amber: { DEFAULT: '#c08a2e', 50: '#f7efdc' },
        red: { DEFAULT: '#c0392b', 50: '#f8e9e7' },
      },
      fontFamily: {
        heading: ['Newsreader', 'Georgia', 'serif'],
        body: ['Mulish', 'system-ui', '-apple-system', 'sans-serif'],
      },
      fontSize: {
        eyebrow: ['0.76rem', { letterSpacing: '0.14em', fontWeight: '700' }],
        lede: ['1.2rem', { lineHeight: '1.55' }],
        sm: ['0.85rem', { lineHeight: '1.5' }],
      },
      borderRadius: {
        DEFAULT: '14px',
        sm: '9px',
        lg: '22px',
        pill: '999px',
      },
      boxShadow: {
        sm: '0 1px 2px rgba(44,40,32,.06), 0 1px 3px rgba(44,40,32,.05)',
        DEFAULT: '0 4px 14px rgba(44,40,32,.08), 0 2px 4px rgba(44,40,32,.05)',
        lg: '0 18px 48px rgba(20,55,95,.16), 0 6px 16px rgba(44,40,32,.08)',
      },
      maxWidth: {
        container: '1180px',
        narrow: '860px',
      },
      screens: {
        nav: '940px',
        md: '780px',
        sm: '620px',
      },
      lineHeight: {
        heading: '1.12',
        body: '1.6',
      },
    },
  },
  plugins: [],
};

export default config;
