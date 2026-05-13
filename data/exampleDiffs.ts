export const exampleDiffs = [
  {
    title: "React useEffect bug",
    diff: `
diff --git a/app/components/UserSearch.tsx b/app/components/UserSearch.tsx
index 8a2d4a1..7bd913c 100644
--- a/app/components/UserSearch.tsx
+++ b/app/components/UserSearch.tsx
@@ -1,14 +1,25 @@
 import { useEffect, useState } from "react";
 
 export function UserSearch({ query }: { query: string }) {
   const [results, setResults] = useState<string[]>([]);
+  const [isReady, setIsReady] = useState(false);
 
   useEffect(() => {
-    searchUsers(query).then(setResults);
-  }, []);
+    if (!isReady) {
+      setIsReady(true);
+      return;
+    }
+
+    searchUsers(query).then(setResults);
+  }, [isReady]);
 
   return (
     <ul>
       {results.map((result) => (
         <li key={result}>{result}</li>
       ))}
     </ul>
   );
 }
`,
  },
  {
    title: "API request with missing error handling",
    diff: `
diff --git a/app/dashboard/ActivityFeed.tsx b/app/dashboard/ActivityFeed.tsx
index 21ea72f..913ad3f 100644
--- a/app/dashboard/ActivityFeed.tsx
+++ b/app/dashboard/ActivityFeed.tsx
@@ -2,9 +2,18 @@ import { useEffect, useState } from "react";
 export function ActivityFeed() {
   const [items, setItems] = useState([]);
 
+  async function loadActivity() {
+    const response = await fetch("/api/activity");
+    const payload = await response.json();
+    setItems(payload.items);
+  }
+
   useEffect(() => {
-    setItems([]);
+    loadActivity();
   }, []);
 
+  console.log("activity", items);
+
   return <FeedList items={items} />;
 }
`,
  },
  {
    title: "TypeScript any weak typing",
    diff: `
diff --git a/lib/formatReview.ts b/lib/formatReview.ts
index 71e24e2..44b901c 100644
--- a/lib/formatReview.ts
+++ b/lib/formatReview.ts
@@ -1,8 +1,14 @@
-export function formatReview(input: ReviewResult) {
+export function formatReview(input: any) {
+  const metadata: any = input.meta || {};
+
   return {
-    title: input.title.trim(),
-    score: input.score,
+    title: input.title,
+    score: Number(input.score),
+    author: metadata.author,
   };
 }
+
+export function persistReview(review: any) {
+  localStorage.setItem("last-review", JSON.stringify(review));
+}
`,
  },
] as const;
