/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{svelte,ts,html}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
};
