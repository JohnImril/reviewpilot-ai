import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
	title: "ReviewPilot AI",
	description:
		"AI-powered Pull Request Review Assistant for structured code review feedback.",
	openGraph: {
		title: "ReviewPilot AI",
		description:
			"AI-powered Pull Request Review Assistant for structured code review feedback.",
		type: "website",
		siteName: "ReviewPilot AI",
	},
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
