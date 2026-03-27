Firebase notes

The current songbook runs in local-only mode.

1. Favorites, notes, and reactions are stored in the browser on each device.
2. The public admin page no longer loads older cloud comments or reactions.
3. Keep `firebase-config.js` only if you plan a future migration or a private owner-only admin workflow.
4. If you reconnect Firebase later, protect it with a secure backend or another private access layer before exposing any cloud data.
