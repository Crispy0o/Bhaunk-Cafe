# Connecting the Bhaunk Café backend (about 10 minutes)

1. Create a new Google Sheet (name it "Bhaunk Café Orders").
2. Extensions → Apps Script. Delete the default code, paste in **Code.gs**.
   (Optional: Project Settings → "Show appsscript.json" and paste in that file too, so the timezone is India.)
3. Pick **setup** in the function dropdown → Run → approve permissions. This creates the Menu, Orders and Staff tabs.
4. Create a staff login: in `addStaff()` change username, displayName and password (10+ characters), pick **addStaff** → Run.
   **Then delete the password from the code.** Only a salted hash is stored in the Staff tab. Repeat for each staff member.
5. Deploy → New deployment → type **Web app** → Execute as: **Me** → Who has access: **Anyone** → Deploy. Copy the Web app URL (ends in `/exec`).
6. Paste that URL into `backendUrl` in `config.js`.
7. Test: place an order on order.html, then log in on staff.html and change its status.

Notes
- After any later change to Code.gs: Deploy → Manage deployments → edit → New version (the URL stays the same).
- 5 wrong passwords lock that username for 15 minutes. Staff sessions last 6 hours.
- Prices live in the Menu tab. The server uses them, never the browser's.
- Staff tab holds hashes only, but keep the Sheet private anyway.
