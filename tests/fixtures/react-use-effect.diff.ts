export const reactUseEffectDiff = `diff --git a/app/components/UserSearch.tsx b/app/components/UserSearch.tsx
index 8a2d4a1..7bd913c 100644
--- a/app/components/UserSearch.tsx
+++ b/app/components/UserSearch.tsx
@@ -1,8 +1,17 @@
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
 
   return <ResultsList items={results} />;
 }`;
