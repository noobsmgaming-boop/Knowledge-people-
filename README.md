# Knowledge People

Knowledge People is a modern social chat website with the brand message **"Connect, Learn and Grow Together"**. The app uses a blue and black premium theme, responsive social-media-inspired UI, Firebase Authentication, Cloud Firestore, Firebase Storage, live friend presence, private conversations, unread notifications, and profile photo uploads.

## Features

- User sign up and login with Firebase Authentication.
- User profile records stored in Cloud Firestore.
- Profile picture upload to Firebase Storage.
- Friend search by name or email prefix.
- Add friends with mirrored friend records for both users.
- Real-time private chat using Firestore snapshot listeners.
- Online/offline presence based on auth state and page visibility.
- Message notification support with browser notification permission.
- Dark mode with local preference persistence.
- Mobile responsive dashboard and chat layout.

## Project structure

```text
.
├── index.html             # App shell, logo, auth forms, profile, friends, and chat markup
├── styles.css             # Premium responsive blue/black theme and dark mode styles
├── app.js                 # Firebase Authentication, Firestore, Storage, friends, chat, and presence logic
├── firebase.json          # Firebase Hosting, Firestore rules, and Storage rules configuration
├── firestore.rules        # Firestore security rules
├── storage.rules          # Storage security rules for profile pictures
└── .firebaserc.example    # Example Firebase project alias file
```

## Firebase setup

1. Create a Firebase project at <https://console.firebase.google.com/>.
2. In **Build > Authentication > Sign-in method**, enable **Email/Password**.
3. In **Build > Firestore Database**, create a database in production mode.
4. In **Build > Storage**, create a default storage bucket.
5. In **Project settings > General > Your apps**, create a Web app and copy the Firebase config.
6. Replace the placeholder `firebaseConfig` values in `app.js`:

```js
const firebaseConfig = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "YOUR_FIREBASE_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_FIREBASE_PROJECT_ID",
  storageBucket: "YOUR_FIREBASE_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_FIREBASE_SENDER_ID",
  appId: "YOUR_FIREBASE_APP_ID",
};
```

7. Optional: copy `.firebaserc.example` to `.firebaserc` and replace `YOUR_FIREBASE_PROJECT_ID`.

## Local development

Because this is a static module-based frontend, you can run it with any static file server:

```bash
python3 -m http.server 5173
```

Then open <http://localhost:5173>.

> Do not open `index.html` directly with a `file://` URL because browser module imports and Firebase network calls work best from an HTTP origin.

## Firestore data model

### `users/{uid}`

Stores public profile and search/presence data:

```json
{
  "uid": "firebase-auth-uid",
  "displayName": "Ada Lovelace",
  "displayNameLower": "ada lovelace",
  "email": "ada@example.com",
  "emailLower": "ada@example.com",
  "photoURL": "https://...",
  "searchTokens": ["a", "ad", "ada", "ada@..."],
  "isOnline": true,
  "lastSeen": "server timestamp",
  "updatedAt": "server timestamp"
}
```

### `users/{uid}/friends/{friendUid}`

Stores friend links. The app writes a mirrored friend document for both users so either person can see the friendship.

```json
{
  "uid": "friend-auth-uid",
  "createdAt": "server timestamp"
}
```

### `conversations/{uidA_uidB}`

The conversation ID is both user IDs sorted and joined with `_`.

```json
{
  "participants": ["uidA", "uidB"],
  "lastMessage": "Hello!",
  "lastSenderId": "uidA",
  "unreadCounts": {
    "uidA": 0,
    "uidB": 2
  },
  "updatedAt": "server timestamp"
}
```

### `conversations/{conversationId}/messages/{messageId}`

```json
{
  "text": "Hello!",
  "senderId": "uidA",
  "receiverId": "uidB",
  "createdAt": "server timestamp",
  "read": false
}
```

## Deploy to Firebase Hosting

Install and authenticate the Firebase CLI:

```bash
npm install -g firebase-tools
firebase login
```

Deploy the static site and security rules:

```bash
firebase use YOUR_FIREBASE_PROJECT_ID
firebase deploy --only hosting,firestore:rules,storage
```

If you do not use `.firebaserc`, pass the project explicitly:

```bash
firebase deploy --project YOUR_FIREBASE_PROJECT_ID --only hosting,firestore:rules,storage
```

## Production hardening checklist

- Review `firestore.rules` and `storage.rules` for your product's exact privacy requirements.
- Add composite indexes if Firestore prompts for one while querying at scale.
- Configure an approved domain list in Firebase Authentication.
- Consider adding Cloud Functions for stronger server-side friend request workflows, push notifications, and message moderation.
- Replace placeholder Firebase config values before deploying.
