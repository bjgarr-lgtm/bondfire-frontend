Bondfire – Auth Landing (real, non-demo)

WHAT THIS IS
- A standalone, production-ready auth homepage.
- Real JWT login via your API; optional register/logout/magic-link/forgot-password.
- After login, users are sent to "#/app" (currently a guarded placeholder). Replace that component with your v4 stable app.

QUICK START
1) Copy this folder somewhere new.
2) Create a .env file here based on .env.example with your API base + endpoints.
3) npm i
4) npm run dev
5) Visit http://localhost:5173/ — you'll see the auth homepage.

INTEGRATE YOUR EXISTING APP
- Replace src/pages/AppGate.jsx with your v4 app mount (or route out to it).
- Keep RequireAuth in src/App.jsx guarding /app (or your private routes).

SECURITY NOTES
- Tokens are saved in localStorage if "Remember me" is checked; otherwise sessionStorage.
- 401s trigger an automatic logout via a central hook.
- Add refresh-token flow later if you have a refresh endpoint; the client is structured for it in src/utils/api.js.
