export const typescriptAnyDiff = `diff --git a/lib/services/reviewService.ts b/lib/services/reviewService.ts
index f11b620..c2b8519 100644
--- a/lib/services/reviewService.ts
+++ b/lib/services/reviewService.ts
@@ -1,11 +1,20 @@
 type ReviewPayload = {
   id: string;
   score: number;
 };
 
-export async function loadReview(id: string): Promise<ReviewPayload> {
+export async function loadReview(id: string): Promise<any> {
   const response = await fetch("/api/reviews/" + id);
-  if (!response.ok) throw new Error("Unable to load review");
-  return response.json();
+  const payload: any = await response.json();
+  return payload as ReviewPayload;
 }
+
+export function normalizeReview(input: any) {
+  return {
+    id: input.id,
+    score: Number(input.score),
+  };
+}`;
