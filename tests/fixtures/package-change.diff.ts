export const packageChangeDiff = `diff --git a/package.json b/package.json
index 07dd135..5de23ab 100644
--- a/package.json
+++ b/package.json
@@ -7,10 +7,12 @@
   "scripts": {
     "dev": "next dev",
     "build": "next build",
+    "analyze": "next build --profile",
     "lint": "eslint"
   },
   "dependencies": {
+    "@next/bundle-analyzer": "^16.2.6",
     "next": "16.2.6",
     "react": "19.2.4"
   }
 }`;
