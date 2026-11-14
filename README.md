# VRChat Dashboard for DeskThing
### See what your VRChat friends are up to, right on your Car Thing. 
![See who's online from your friends list, at a glance](https://i.imgur.com/YQICnTv.png)
### See who's online from your friends list, at a glance.

![Clicking on a friend brings up an easy to read version of their full profile!](https://i.imgur.com/5VBfyJa.png)
### Clicking on a friend in the grid brings up an easy to read version of their full profile!

## Usage
1. Install the packaged app in DeskThing and open its settings.
2. Enter your **VRChat account username** and password, then save. Use your account username, rather than your display name or Steam/Meta login.
3. Open the dashboard. If verification is required, the display asks for an authenticator or email code. Enter a **fresh** code in DeskThing's **2FA Code** setting and save. The pending login resumes automatically, and the code is cleared after submission.
4. Subsequent launches restore the saved session. A new credential login happens only after VRChat rejects the saved session with HTTP 401. Use **Refresh Friends** to retry a failed request.

The first launch after updating from 0.11 requires a new login. Legacy editable cookie settings are removed; sessions now live in DeskThing's persistent app data and are bound to the configured username. Keep DeskThing's app data across restarts and upgrades. Credentials and session cookies are sensitive local data; this app does not encrypt DeskThing's storage.

The friends list appears before optional images and world details finish loading. Private/inaccessible instances or failed image downloads do not discard the list. Errors and verification prompts appear on the display instead of leaving a spinner running.

Opening a friend's profile fetches their bio and profile image from VRChat's current public-profile endpoint. Images support the current `iconUrl` field and legacy image fields, and are downloaded using the existing session. If an image is unavailable, the UI tries alternatives and then shows a placeholder. Friend and image updates continue while a profile is open. Updating from 0.12.0 preserves the saved login session.
**Do note that this program is limited to loading in the information of a maximum of 50 friends at once, to help save on the Car Thing's limited RAM.**

## Development and verification

Use Node.js 22 and install dependencies with `npm ci`.

```sh
npm test
npm run typecheck
npm run lint
npm run build
npm run test:package
```

The authentication tests use a local HTTP server and exercise real cookie handling. They never use a VRChat account. Profile tests cover current and legacy fields, fallback endpoints, image formats, and failed downloads. The package test boots the built server in a worker and simulates DeskThing's settings bridge. Build output is in `dist/`; install `vrchat-dashboard-v0.12.1.zip` through DeskThing.

VRChat's current [public profile response](https://vrchat.community/reference/get-public-profile) contains `bio`, `pronouns`, and `iconUrl`; these details are not all present in the [friends response](https://vrchat.community/reference/get-friends).

See [authentication reliability notes](docs/authentication.md) for the original failure modes, design decisions, and the remaining device checks.

## Bug Reports
If you have issues with this program at any time, don't be afraid to open an issue, and I'll see what I can do to fix things up. This is still a work in progress! I'm still working out a few things with the user interface.
