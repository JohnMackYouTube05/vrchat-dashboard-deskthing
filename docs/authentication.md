# Authentication reliability

The original failures have several independent causes in the app. There may also have been upstream failures: VRChat [reported and fixed an intermittent 2FA cookie/caching issue in August 2025](https://ask.vrchat.com/t/developer-update-28-august-2025/46531). Without logs from the original attempts, that incident cannot be tied to this app's reported failure rate.

## Findings in the original code

| Failure | Effect | Replacement |
| --- | --- | --- |
| Client handler started an unawaited login, then friends loading started another login | Concurrent logins replaced shared global cookie jars and API clients during verification | All requests share one in-flight authentication promise and one client |
| Cookie setting declared as `cookieJar`, read/written as `cookiejar`; cookie saving referenced undefined `COOKIE_FILE` | Saved sessions failed to restore or save | One versioned, account-bound cookie jar in DeskThing app data |
| Compared `requiresTwoFactorAuth` directly to strings | Array challenges were skipped, then the app declared itself logged in | Handle method arrays; verify a real current-user response before marking authenticated |
| Credentials remained in SDK configuration; each friends request reinitialized login | Boot and refresh could create unnecessary sessions | Cookie-only validation; Basic auth on one login request only, after HTTP 401 |
| Static code supplied before the challenge, and reused after errors | Codes expired or were submitted against a different pending login | Save the pending cookie before waiting; consume each code once; resume with a new code |
| Full settings, API objects, code and Axios errors logged | Sensitive values could appear in app logs | App errors use fixed, sanitized messages; raw request objects are not logged by app code |
| Image helper created an unwrapped Axios client and called `/auth/user` for every image | Unauthenticated downloads and unnecessary auth traffic | Shared cookie-aware client, no authentication calls from image loading |
| Waited for all friend enrichment before sending anything | One inaccessible instance could discard a successful friends response | Send the list first; tolerate missing details; limit enrichment to three workers |
| Card components fetched world data again, with uncorrelated responses | Duplicate requests and potentially incorrect world labels | Cards use world data already attached to each friend |
| Component timer was a render-local variable and listeners were never removed | Stale timers/listeners and misleading timeout messages | Stable timer reference, listener cleanup, explicit server status/error messages |
| DeskThing SDK `initSettings` does not await its internal `setSettings` call | Settings could be read before initialization finished | Await `setSettings`; normalize legacy keys and preserve credentials |

## Session behavior

The [community API specification](https://vrchat.community/reference/get-current-user) warns that credential logins consume limited sessions and recommends persisting cookies across process restarts. Authentication here uses the documented HTTP endpoints directly through Axios and a `tough-cookie` jar; the old VRChat package supplies types only. This also avoids its older, separate Axios dependency in the server bundle.

1. Wait for DeskThing settings and persisted data. A storage timeout must not be interpreted as an empty session and trigger another login.
2. Restore cookies only for the matching configured account. Probe `/auth/user` without credentials.
3. Only HTTP 401 permits a credential login. Encode username and password separately before constructing the Basic header. Never use Basic auth for verification, friends, worlds, instances or images.
4. Persist the pending auth cookie before asking for 2FA. Support `totp` and `emailOtp`, and retain the same jar when the user saves a code or restarts the app.
5. Clear the submitted code, verify it once, then fetch the current user without credentials and persist the completed jar.
6. Reuse the validated session in memory. An API read returning HTTP 401 triggers cookie validation and at most one retry. HTTP 403 does not invalidate the login.
7. Authentication transport errors and throttling impose a cooldown of at least 30 seconds, respecting longer `Retry-After` values. They never cause automatic credential retries. The user retries through Refresh Friends. Optional resource failures do not initiate credential login unless the server returned HTTP 401.

Sessions do not survive deletion of DeskThing's app data. The SDK sends persistence messages to the desktop host without a disk-write acknowledgment, so actual durability still depends on DeskThing. No standalone cookie file is written relative to an unpredictable working directory. Older jars are not imported because they have no reliable account binding; one fresh login is required after updating.

No automatic logout runs on app shutdown, since that would invalidate the session needed on the next boot. Changing the username discards this app's old jar. The server must still be reachable to validate an account; revoked/expired sessions and upstream service outages remain possible.

## Verification and remaining checks

`npm test` covers concurrent logins, persistence without 2FA, both verification methods, restart while waiting for verification, rejected codes, session revocation, account changes, corrupt cookies, network errors, throttling, forbidden resources, and unavailable storage. Tests use local HTTP rather than mocking out cookie transport. `npm run test:package` additionally exercises the real built server and DeskThing SDK settings bridge.

Before calling this device-verified:

1. Install the built ZIP; enter the account username and password. Confirm the display requests the correct verification method.
2. Save a fresh code after the prompt and confirm friends appear. Try an expired code first and confirm saving a new one succeeds without restarting.
3. Restart the app and the DeskThing desktop host repeatedly. Confirm no fresh verification prompt while the session remains valid.
4. Restart while waiting for email verification; complete the same pending login after restart.
5. Disconnect the network during boot, restore it, and press Refresh Friends. Confirm it recovers without rapid repeated logins.
6. Check image resource URLs on the physical display. This keeps the existing DeskThing `localhost:8891/resource/image/vrchat/` routing convention, which still needs a hardware check.

Do not share raw DeskThing data or debug logs without checking them: passwords and cookies are local secrets, and the installed DeskThing SDK itself can print incoming settings at debug level.
