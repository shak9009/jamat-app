# Jamait e Ahle Hadees App

React Native CLI mobile app + optional Node.js backend for admin bulk operations. Data lives in Firebase (Firestore + Auth).

## Structure

```
JamaitApp/
├── App.js
├── package.json
├── src/
│   ├── config/firebase.js       # re-exports RNFirebase auth/firestore
│   ├── context/AuthContext.js   # login/register/logout + role lookup
│   ├── navigation/RootNavigator.js  # auth flow + role-gated tabs
│   └── screens/
│       ├── Auth/         (Login, Register)
│       ├── Voter/        (VoterListScreen)
│       ├── Events/       (EventsScreen)
│       ├── Questions/    (AskQuestionsScreen)
│       ├── Donation/     (DonationScreen)
│       └── Admin/        (AdminDashboardScreen — visible only when role === 'admin')
└── backend/
    ├── server.js         # Express + firebase-admin, admin-only bulk ops
    └── package.json
```

## 1. Create the RN CLI project

This scaffold assumes a project created with:

```bash
npx @react-native-community/cli init JamaitApp
```

Then copy `App.js` and `src/` from this scaffold into your generated project (overwrite the default `App.js`), and merge the `dependencies` from this `package.json` into yours.

## 2. Install dependencies

```bash
npm install
npm install @react-native-firebase/app @react-native-firebase/auth @react-native-firebase/firestore
npm install @react-navigation/native @react-navigation/native-stack @react-navigation/bottom-tabs
npm install react-native-safe-area-context react-native-screens
cd ios && pod install && cd ..   # iOS only
```

## 3. Firebase setup

1. Create a Firebase project → enable **Authentication (Email/Password)** and **Firestore**.
2. Add an Android app → download `google-services.json` → place in `android/app/`.
3. Add an iOS app → download `GoogleService-Info.plist` → add to the Xcode project.
4. Follow the native install steps for `@react-native-firebase/app` (Android `build.gradle` changes, iOS `AppDelegate` changes) — see https://rnfirebase.io/

## 4. Firestore collections

| Collection  | Fields |
|---|---|
| `users`     | name, email, role ('user' \| 'admin'), createdAt |
| `voters`    | name, boothCode, wardCode |
| `events`    | title, description, date |
| `questions` | text, askedBy, answer, createdAt |
| `donations` | amount, donorId, status, createdAt |

## 5. Firestore security rules (starting point)

Lock down writes so only admins can write to `voters`/`events`, and users can only read/write their own donation/question docs. Example sketch:

```
match /users/{uid} {
  allow read: if request.auth.uid == uid || get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
  allow write: if request.auth.uid == uid;
}
match /voters/{id} {
  allow read: if request.auth != null;
  allow write: if get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
}
```
Fill in the rest per collection before going live — do not ship with test-mode rules.

## 6. Admin roles

New users register with `role: 'user'` by default (see `AuthContext.register`). To make someone an admin, either:
- Manually edit their `role` field to `'admin'` in the Firestore console, or
- Run the backend and call `POST /api/users/:uid/make-admin` as an existing admin.

## 7. Backend (optional, for bulk voter import)

```bash
cd backend
npm install
# add serviceAccountKey.json (Firebase Console → Project Settings → Service Accounts)
npm start
```

## 8. Donations

`DonationScreen` currently records donation intent in Firestore only — no money moves. Wire in Razorpay/Stripe/PayU before going live, and update the `status` field from your payment webhook.

## Next steps

- Add push notifications for new events/answers (Firebase Cloud Messaging)
- Add pagination to VoterListScreen once the voter list is large
- Wire up the voter PDF import you mentioned for the web project into `backend/server.js`'s bulk-import endpoint
