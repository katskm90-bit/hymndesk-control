# HymnDesk Control · Setup

Internal project management app for the HymnDesk production team. Skeleton stage: login, role detection, routing, and placeholders for all 17 modules. No module logic yet.

## File overview

```
hymndesk-control/
├── index.html              The single HTML shell
├── manifest.json           PWA manifest
├── sw.js                   Service worker, silent update pattern
├── bootstrap_admin.sql     Run once to make yourself Admin
├── js/
│   ├── config.js           Your Supabase URL and anon key go here
│   └── app.js              Auth flow, routing, role detection
└── icons/
    └── README.txt          Drop icon-192.png and icon-512.png here
```

## How the auth flow works

1. Admin creates an invitation in the app (still to be built in Module 6).
2. The invitation triggers an email to the recipient via Resend.
3. The recipient sets their own password through Supabase Auth.
4. Their `public.users` profile is created with the role the Admin chose.
5. On login, the app reads the profile, looks up the role, and renders the role-aware home page.

For now, only step 5 is live. You bootstrap yourself as Admin using the dashboard plus `bootstrap_admin.sql`.

## What to deploy and in what order

Step-by-step instructions are in the chat message that delivered these files. Keep this file as a reference if you come back later.
