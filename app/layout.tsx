import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ReviewPilot AI",
  description:
    "AI-powered pull request review assistant for structured git diff analysis.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
