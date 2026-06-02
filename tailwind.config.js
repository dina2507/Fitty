export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        // muscle-group accents (kept from v1)
        push: '#ef4444',
        pull: '#3b82f6',
        legs: '#8b5cf6',
        // semantic tokens (light, premium & clean)
        surface: {
          DEFAULT: '#f4f4f5', // app background (zinc-100)
          raised: '#ffffff',  // cards (white)
          overlay: '#ffffff', // inner panels or inputs
          border: '#e4e4e7',  // borders (zinc-200)
        },
        accent: {
          DEFAULT: '#27272a', // zinc-800 — primary / active / log
          soft: '#f4f4f5',    // zinc-100 — subtle highlight background
          fg: '#18181b',      // zinc-900 for text contrast
        },
        pr: '#d97706',        // amber-600 — personal records
        ok: '#059669',        // emerald-600 — success
        warn: '#d97706',      // amber-600 — warning
        danger: '#dc2626',    // red-600 — danger / errors
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.02)',
      },
    },
  },
  plugins: [],
  darkMode: 'class',
}
