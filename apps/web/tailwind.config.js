/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      outlineWidth: {
        4: '4px',
      },
      outlineColor: {
        ring: 'hsl(262 83% 58%)',
      },
    },
  },
  plugins: [],
};
