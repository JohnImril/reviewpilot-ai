export const securityRiskDiff = `diff --git a/app/security/SafeHtml.tsx b/app/security/SafeHtml.tsx
index 1234567..89abcde 100644
--- a/app/security/SafeHtml.tsx
+++ b/app/security/SafeHtml.tsx
@@ -1,6 +1,10 @@
 export function SafeHtml({ html }: { html: string }) {
+  // TODO: sanitize this before release
+  console.log("rendering html", html);
   return (
-    <div>{html}</div>
+    <div dangerouslySetInnerHTML={{ __html: html }} />
   );
 }`;
