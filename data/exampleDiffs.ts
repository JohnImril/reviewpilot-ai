import type { ReviewMode } from "@/lib/schemas/review";

export const exampleDiffs: Array<{
	title: string;
	description: string;
	mode: ReviewMode;
	diff: string;
}> = [
	{
		title: "React useEffect dependency issue",
		description:
			"A search component adds request logic but leaves the changing query out of the effect dependency array.",
		mode: "react",
		diff: `
diff --git a/app/components/UserSearch.tsx b/app/components/UserSearch.tsx
index 8a2d4a1..7bd913c 100644
--- a/app/components/UserSearch.tsx
+++ b/app/components/UserSearch.tsx
@@ -1,12 +1,28 @@
 import { useEffect, useState } from "react";
 
 export function UserSearch({ query }: { query: string }) {
   const [results, setResults] = useState<string[]>([]);
+  const [isLoading, setIsLoading] = useState(false);
 
-    searchUsers(query).then(setResults);
+  useEffect(() => {
+    setIsLoading(true);
+    fetch("/api/users?query=" + query)
+      .then((response) => response.json())
+      .then((payload) => {
+        setResults(payload.items);
+        setIsLoading(false);
+      });
+  }, []);
 
   return (
     <section>
+      {isLoading ? <p>Loading...</p> : null}
       <ul>
         {results.map((result) => (
           <li key={result}>{result}</li>
         ))}
       </ul>
     </section>
   );
 }
`,
	},
	{
		title: "TypeScript weak typing in a service file",
		description:
			"A review service accepts unknown API payloads with any and type assertions instead of validating the response boundary.",
		mode: "typescript",
		diff: `
diff --git a/lib/services/reviewService.ts b/lib/services/reviewService.ts
index f11b620..c2b8519 100644
--- a/lib/services/reviewService.ts
+++ b/lib/services/reviewService.ts
@@ -1,12 +1,23 @@
 type ReviewPayload = {
   id: string;
   score: number;
 };
 
-export async function loadReview(id: string): Promise<ReviewPayload> {
+export async function loadReview(id: string): Promise<any> {
   const response = await fetch("/api/reviews/" + id);
-  if (!response.ok) {
-    throw new Error("Unable to load review");
-  }
-  return response.json();
+  const payload: any = await response.json();
+  return payload as ReviewPayload;
 }
+
+export function normalizeReview(input: any) {
+  return {
+    id: input.id,
+    score: Number(input.score),
+    author: input.meta.author,
+  };
+}
`,
	},
	{
		title: "Frontend performance issue in a component file",
		description:
			"A dashboard queue sorts and filters during render while passing inline object and function props to every row.",
		mode: "performance",
		diff: `
diff --git a/app/dashboard/ReviewQueue.tsx b/app/dashboard/ReviewQueue.tsx
index b2f4482..d7a2fb1 100644
--- a/app/dashboard/ReviewQueue.tsx
+++ b/app/dashboard/ReviewQueue.tsx
@@ -1,14 +1,28 @@
 export function ReviewQueue({ items, currentUser }: ReviewQueueProps) {
+  const visibleItems = items
+    .filter((item) => item.status !== "archived")
+    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
+
   return (
     <section>
-      {items.map((item) => (
+      {visibleItems.map((item) => (
         <ReviewQueueRow
           key={item.id}
           item={item}
-          ownerId={currentUser.id}
+          owner={{ id: currentUser.id, name: currentUser.name }}
+          onSelect={() => {
+            console.log("opening review", item.id);
+            trackReviewOpen(item.id);
+            openReview(item.id);
+          }}
         />
       ))}
     </section>
   );
 }
`,
	},
	{
		title: "package.json dependency change",
		description:
			"A dependency and script change should be treated as release-impacting even when the code diff is small.",
		mode: "general",
		diff: `
diff --git a/package.json b/package.json
index 07dd135..5de23ab 100644
--- a/package.json
+++ b/package.json
@@ -7,11 +7,13 @@
   "scripts": {
     "dev": "next dev",
     "build": "next build",
+    "analyze": "next build --profile",
     "start": "next start",
     "lint": "eslint"
   },
   "dependencies": {
+    "@next/bundle-analyzer": "^16.2.6",
     "next": "16.2.6",
     "react": "19.2.4",
     "react-dom": "19.2.4"
   }
 }
`,
	},
];
