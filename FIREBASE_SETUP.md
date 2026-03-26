Firebase setup checklist

1. Create a Firebase project
2. Add a Web app and copy the config into `firebase-config.js`
3. Authentication
   - Enable Google sign-in
   - Enable Facebook sign-in
   - Add `wisdomchiru9-png.github.io` to Authorized domains
4. Firestore Database
   - Create the database in production mode
   - Add the rules below
5. Admin allowlist
   - Update `adminEmails` in `firebase-config.js` with the owner email

Suggested Firestore rules

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAdmin() {
      return exists(/databases/$(database)/documents/admins/$(request.auth.uid));
    }

    match /admins/{uid} {
      allow read: if request.auth.uid == uid;
      allow create: if request.auth.token.email in ["wisdomchhiru9@gmail.com"];
    }

    match /signins/{docId} {
      allow read: if isAdmin();
      allow create, update: if request.auth != null;
    }

    match /comments/{docId} {
      allow read: if true;
      allow create: if request.auth != null;
      allow update, delete: if request.auth.uid == resource.data.uid;
    }

    match /reactions/{docId} {
      allow read: if true;
      allow create: if request.auth != null;
    }

    match /reactionCounts/{docId} {
      allow read: if true;
      allow create, update: if request.auth != null;
    }
  }
}
```
