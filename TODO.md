# TODO: Migrate to JWT Authentication for Multi-Network Support

- [x] Install jsonwebtoken package in Backend
- [x] Search for files importing authSession.js and update imports
- [x] Rename authSession.js to authJWT.js
- [x] Update authJWT.js to verify JWT from Authorization header
- [x] Update routes.js to import authJWT instead of authSession
- [x] Update app.js: Remove session middleware, proxy, debug; add CORS; mount routes directly
- [x] Update auth.service.js: Add JWT generation and verification functions
- [x] Update auth.routes.js: Modify /login to return JWT; add /refresh endpoint
- [x] Update Frontend/src/stores/auth.ts: Store JWT in localStorage, send in headers
- [x] Update Frontend/src/views/LoginView.vue: Use auth store login method
- [x] Update Frontend/src/router/index.ts: Use checkAuth instead of checkSession
- [x] Update Frontend/vite.config.ts: Remove proxy, use direct API calls
- [x] Update Frontend/src/stores/auth.ts: Use VITE_API_URL for all API calls
- [x] Fix TypeScript types in auth store
- [ ] Test authentication from different networks (user will perform manual testing)
