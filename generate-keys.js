// generate-keys.js
// Run once with:  npm run keys
// It prints two keys. Copy them into your environment variables (the launch
// guide shows exactly where). These let your server send push notifications.

import webpush from "web-push";
const keys = webpush.generateVAPIDKeys();
console.log("\n=== COPY THESE INTO YOUR ENVIRONMENT VARIABLES ===\n");
console.log("VAPID_PUBLIC_KEY=" + keys.publicKey);
console.log("VAPID_PRIVATE_KEY=" + keys.privateKey);
console.log("\n(Keep the private key secret. The public key is safe to share.)\n");
