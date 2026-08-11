import Constants from "expo-constants";

/**
 * Where the Swiftcart API lives, from the device's point of view.
 *
 * `localhost` on a phone is the phone, so this can never be hardcoded:
 *
 *   1. `EXPO_PUBLIC_API_URL` — Expo inlines `EXPO_PUBLIC_*` at bundle time, so
 *      this needs no app.json entry. Set it when using
 *      `adb reverse tcp:4000 tcp:4000` (then `http://localhost:4000`).
 *   2. Metro's own LAN address — if the bundler is reached at
 *      `192.168.1.5:8081`, the API is almost certainly at `192.168.1.5:4000`.
 *
 * The fallback only fires for a bare IPv4 host. Under `--tunnel` the host is
 * something like `abc.exp.direct`, which has no API on port 4000; guessing
 * would produce a confusing timeout instead of the message below.
 */

const API_PORT = 4000;
const IPV4 = /^\d{1,3}(?:\.\d{1,3}){3}$/;

function fromEnvironment(): string | null {
  const raw = process.env.EXPO_PUBLIC_API_URL?.trim();
  return raw ? raw.replace(/\/+$/, "") : null;
}

function fromMetroHost(): string | null {
  // hostUri is "host:port" with no scheme, so `new URL` can't parse it.
  const host = Constants.expoConfig?.hostUri?.split("/")[0]?.split(":")[0];
  return host && IPV4.test(host) ? `http://${host}:${API_PORT}` : null;
}

export const API_ORIGIN = fromEnvironment() ?? fromMetroHost();
export const API_BASE_URL = API_ORIGIN ? `${API_ORIGIN}/v1` : null;

export const API_URL_HELP =
  "Could not work out the API address. Start the API, then run Expo with " +
  "EXPO_PUBLIC_API_URL set (e.g. EXPO_PUBLIC_API_URL=http://localhost:4000 " +
  "after `adb reverse tcp:4000 tcp:4000`).";
