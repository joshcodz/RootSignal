import "./globals.css";

export const metadata = {
  title: "RootSignal",
  description: "AI-powered root cause analysis for production incidents",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-gray-100 antialiased">{children}</body>
    </html>
  );
}
