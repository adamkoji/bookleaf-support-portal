import "./globals.css";

export const metadata = {
  title: "BookLeaf Publishing — Author Support & Operations Portal",
  description:
    "AI-Powered Author Support, Book Royalty Ledger, and Admin Operations Triage Console for BookLeaf Publishing.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 selection:bg-emerald-600 selection:text-white">
        {children}
      </body>
    </html>
  );
}

