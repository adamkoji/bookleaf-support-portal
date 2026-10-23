import "./globals.css";

export const metadata = {
  title: "BookLeaf Publishing — Author Support & Publishing Portal",
  description:
    "Official Author Support, Sales Reports, Royalty Ledger, and Support Desk for BookLeaf Publishing (www.bookleafpub.in).",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#FFFDFD] text-[#222222] selection:bg-[#EC6568] selection:text-white">
        {children}
      </body>
    </html>
  );
}
