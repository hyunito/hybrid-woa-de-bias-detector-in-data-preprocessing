/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          900: '#0B1528',
          800: '#111E38',
          700: '#1A2C4E',
        },
      },
    },
  },
  plugins: [],
}
