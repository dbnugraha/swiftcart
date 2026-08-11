# Swiftcart

A demo e-commerce app: browse a catalogue, add to a cart, check out, and see
your orders. Modelled on [saucedemo.com](https://www.saucedemo.com/inventory.html)
— the same shopping flow, as a native app rather than a web page.

**The whole flow is here except taking payment.** Checkout collects a shipping
address, shows a real total, decrements stock in a transaction and creates an
order. Where a payment step would go, there is a note saying so.

Expo (React Native) · Express 5 · Prisma 7 · PostgreSQL · TypeScript.

---

## Layout

```
apps/
  api/        Express 5 + Prisma 7 + Postgres
  mobile/     Expo SDK 57, expo-router
packages/
  shared/     wire types, error codes, money arithmetic
```

`packages/shared` is why this is a monorepo rather than two folders: the
server's responses and the client's fetch calls are checked against one
definition, so renaming a field breaks the build instead of the app.

---

## Running it

Needs Node 20.19+, Docker, and a device or emulator.

```bash
npm install                     # also builds packages/shared

cp apps/api/.env.example apps/api/.env
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
#   paste that as JWT_SECRET

npm run db:up                   # Postgres on host port 5433
npm run migrate
npm run seed                    # 194 products, 24 categories, demo account
npm run api                     # http://localhost:4000
```

Then, in a second terminal:

```bash
npm run mobile:adb              # USB device or emulator
npm run mobile:tunnel           # same, but Metro over a tunnel
```

Sign in with **demo@swiftcart.test** / **swiftcart123**, or create an account.

### Connecting the phone to the API

`localhost` on a phone is the phone, so the address is resolved rather than
hardcoded — see [`src/lib/config.ts`](apps/mobile/src/lib/config.ts). Both
scripts above run `adb reverse tcp:4000 tcp:4000` first and set
`EXPO_PUBLIC_API_URL` accordingly.

These are independent: `--tunnel` carries **Metro**, `adb reverse` carries the
**API**. Tunnelling Metro does not require tunnelling the API too.

`adb reverse` does not survive an unplug or an adb server restart. If the app
suddenly cannot reach the API, re-run it before assuming something broke.

---

## Where the data comes from

Seeded **once** from [DummyJSON](https://dummyjson.com) into our own tables —
194 products across 24 categories, with images, ratings, tags and reviews.

The running API never calls a third party. That keeps the demo working offline,
and more importantly makes stock *ours*, so checkout can actually decrement it.
A read-only upstream could never do that. Re-running the seed upserts on the
source id, so it is safe.

---

## Things worth knowing before changing code

**Money is integer cents everywhere** — database, wire, client state. Floating
point cannot represent most decimal fractions, so prices held as `number` drift
the moment you total them, and a cart ends up disagreeing with the sum of its
own lines. Conversion to a decimal happens once, at display, via `formatCents`.
`calculateTotals` in [`packages/shared/src/money.ts`](packages/shared/src/money.ts)
is the single definition of what an order costs; the server recomputes from its
own prices but uses identical arithmetic.

**Checkout decrements stock with a conditional UPDATE**, not a read-then-write.
Two shoppers buying the last unit would both pass a `SELECT stock` check;
`WHERE stock >= quantity` lets the database arbitrate, and the loser gets a
clean 409 rather than the shop overselling. Throwing rolls back every decrement
in the transaction, so a partial order cannot be committed.

**Order lines snapshot title and price.** A past order must never re-read
today's catalogue, or a price change would silently rewrite what someone was
charged.

**Cart writes are serialised per product, and the payload is read at send
time.** Optimistic updates apply immediately; the queued task resolves the
target when it sends, not when the button was tapped. Capturing it at tap time
is what caused a quantity race where fast taps sent a stale base. See the
comment at the top of [`src/context/cart.tsx`](apps/mobile/src/context/cart.tsx).

**Refresh is single-flight.** The server rotates refresh tokens with reuse
detection and no grace window, so two concurrent refreshes would look like a
replay and revoke the whole token family — signing the user out. The
module-level promise in [`src/lib/api.ts`](apps/mobile/src/lib/api.ts) is a
correctness requirement, not an optimisation.

**`packages/shared` is compiled to `dist`.** A `.ts` entry point works for
Metro but NodeNext resolution refuses to follow it, so the API could not
typecheck against source. `npm install` builds it; use `npm run dev:shared` to
watch while editing it.

**Errors use one envelope**, `{ error: { code, message, fields? } }`. The client
switches on `code`, never on message text. Ownership failures return 404 rather
than 403 — a 403 would confirm the resource exists.

---

## Checks

```bash
npm run typecheck               # all three packages
npm run lint
```

There is an end-to-end API harness covering the purchase flow, money
arithmetic, stock decrement, the quantity race and every error path — 61 checks
against a running server.

---

## API

Base path `/v1`. The catalogue is public; everything else needs
`Authorization: Bearer <access>`.

| Method | Path | Notes |
|---|---|---|
| POST | `/auth/sign-up` · `/sign-in` · `/refresh` · `/sign-out` | rotating refresh tokens |
| GET | `/me` | profile + order count |
| GET | `/products` | `search`, `category`, `sort`, `limit`, `offset` |
| GET | `/products/categories` · `/products/random` · `/products/:id` | |
| GET · POST | `/cart` · `/cart/items` | |
| PATCH · DELETE | `/cart/items/:productId` | absolute quantity; idempotent |
| GET · POST | `/orders` | POST places the order |
| GET | `/orders/:id` | 404 for someone else's |
| GET | `/healthz` | 503 only when Postgres is down |
