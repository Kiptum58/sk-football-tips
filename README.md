# SK Football Tips — Android starter

This is an Expo / React Native starter prototype for SK Football Tips.

## Run it
1. Install Node.js (LTS) on your computer.
2. Extract this ZIP.
3. Open a terminal in this folder and run `npm install`.
4. Run `npx expo start`.
5. Install Expo Go on an Android phone and scan the QR code, or run `npx expo start --android`.

## Included in this prototype
- Dark football dashboard
- Sample prediction cards
- League filter
- Free and premium labels
- AI / expert source labels
- Demo manual prediction publisher
- Fixtures, Premium, Admin and Profile tabs

## Important: not production-ready yet
The sample matches and predictions are illustrative placeholders. No real AI model, live fixture provider, user database, secure admin login, subscription billing, or results verification is connected yet. The admin screen and premium toggle are demo-only and must not be treated as secure access controls.

## Planned production stages
1. Connect a licensed football data API for fixtures, results and statistics.
2. Build a backend (for example Supabase) with user authentication, database and admin roles.
3. Add AI/statistical prediction services and transparent prediction history.
4. Add premium entitlements and compliant subscription billing.
5. Test, create a signed Android App Bundle (AAB), and prepare the Google Play listing.

Android application ID currently set to `com.skfootballtips.app`. Choose the final package ID before first Play Store publication; changing it later creates a separate app listing.
