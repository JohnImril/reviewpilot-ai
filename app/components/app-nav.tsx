import { GitPullRequestArrow } from "lucide-react";
import Link from "next/link";
import type React from "react";

export function AppNav({ current }: { current: "home" | "examples" }) {
	return (
		<nav className="flex flex-wrap items-center justify-between gap-4">
			<Link href="/" className="flex items-center gap-3">
				<div className="flex size-11 items-center justify-center rounded-lg bg-zinc-950 text-white">
					<GitPullRequestArrow
						className="size-5"
						aria-hidden="true"
					/>
				</div>
				<div>
					<p className="text-sm font-medium text-zinc-500">
						ReviewPilot AI
					</p>
					<h1 className="text-2xl font-semibold tracking-normal text-zinc-950 sm:text-3xl">
						Pull request review assistant
					</h1>
				</div>
			</Link>
			<div className="flex flex-wrap items-center gap-2">
				<NavLink href="/" isActive={current === "home"}>
					Dashboard
				</NavLink>
				<NavLink href="/examples" isActive={current === "examples"}>
					Examples
				</NavLink>
				<div className="rounded-full border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm font-medium text-zinc-600">
					Mock AI provider active
				</div>
			</div>
		</nav>
	);
}

function NavLink({
	href,
	isActive,
	children,
}: {
	href: string;
	isActive: boolean;
	children: React.ReactNode;
}) {
	return (
		<Link
			href={href}
			className={`inline-flex h-10 items-center rounded-md border px-3 text-sm font-semibold transition ${
				isActive
					? "border-zinc-950 bg-zinc-950 text-white"
					: "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
			}`}
			aria-current={isActive ? "page" : undefined}
		>
			{children}
		</Link>
	);
}
