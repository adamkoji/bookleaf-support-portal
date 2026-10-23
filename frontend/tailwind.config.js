/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,jsx}",
    "./src/components/**/*.{js,jsx}",
    "./src/app/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        bookleaf: {
          coral: "#EC6568",
          coralHover: "#D95356",
          blush: "#FFF5F6",
          blushDeep: "#FCE8EA",
          iconBg: "#FDE8E9",
          teal: "#3898A6",
          dark: "#111111",
          charcoal: "#222222",
        },
      },
    },
  },
  plugins: [],
};
