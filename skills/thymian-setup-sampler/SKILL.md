---
name: thymian-setup-sampler
description: Set up sampler hooks so every declared transaction runs against a live API. Use when writing or debugging hooks under `.thymian/sampler/hooks`, when `thymian sampler check` reports skipped transactions, when a run needs credentials or seeded resources, or when `thymian test` skips a transaction that `sampler check` passes.
---

# Set up the sampler

Done is two readings, not one: `thymian sampler check` printing **all passed**, and
`thymian test` adding no skip that names a status mismatch. Both, because the two commands
exercise the hooks differently — and that difference is where the bugs live.

## The two gates

| Command                 | Requests per transaction | Catches                                                     |
| ----------------------- | ------------------------ | ----------------------------------------------------------- |
| `thymian sampler check` | one                      | a transaction that cannot be built, authenticated or seeded |
| `thymian test`          | one **per rule**         | a fixture that only works once                              |

The multiplier is large: one measured run turned 45 declared transactions into 442 requests.
A hook that seeds a single deletable row therefore passes `check` and then fails `test` from
the second rule onward. Run both, in that order — `check` localises a fault to one
transaction, `test` does not.

## Steps

1. Point `thymian.config.yaml` at the description, and confirm the API answers.
2. Read one request before changing anything: `thymian sampler show '<selector>'`. A wrong
   selector prints the near misses, which is the fastest way to the exact spelling.
   `"authorize": true` is the description's `security` requirement.
3. Write the identities — see [Hitting a declared status](#hitting-a-declared-status). A
   global `authorize` for the common one, targeted `authorize` for the rest.
4. Shape each remaining transaction to its declared status, seeding by lifetime — see
   [Read or spent](#read-or-spent).
5. `thymian sampler check` until it prints `Checked <N> transactions. All passed.`
6. `thymian test`. Every surviving skip must name either a response header the API does not
   emit (`ETag`, `Last-Modified`, `Accept-Ranges`) or a rule that altered the request itself.
   A skip reading `Expected status code <declared>, but received <other>`, on a rule that
   left the request alone, is a spent fixture — return to step 4.
7. `thymian sampler init` once, then commit `generated/`. `sampler validate` type-checks the
   hooks; `sampler sync --check` is the CI gate. The scaffolded tsconfig pulls in no ambient
   Node types, so encode credentials inside the hook file or add `"types": ["node"]` to it.

## The pipeline

Per request: `defineSample` → `utils.request` args overlay → `beforeEach` → `authorize` →
send → `afterEach`.

Two consequences carry most of the mistakes:

- `defineSample` runs at projection time, **before** the run's `beforeAll`, so it reads no
  seeded state. Give it static shaping only — a unique value, a valid foreign key — and put
  anything that depends on a fixture in `beforeEach` or `authorize`.
- `beforeEach` runs after the overlay, so a hook that always writes a field overwrites what a
  caller passed to `utils.request`. Keep a caller-supplied value where it is present:

  ```ts
  const ownerId = request.body.owner_id > 0 ? request.body.owner_id : (await seedOwner(utils)).id;
  ```

## Read or spent

Every fixture is one of two things, and the answer decides where it is seeded.

- **Read** — a row a transaction looks at and leaves intact. Seed once, in `beforeAll`.
- **Spent** — a row it deletes, a slot it fills, a unique value it claims. Seed per request,
  in `beforeEach`, so the second rule to run the transaction gets its own.

Seed in `authorize` instead when the fixture **is** the credential, such as a self-delete
where the credentials die with the row. That also keeps a rule honest when it forces
`authorize: false` to probe an unauthenticated response: the hook does not run, and the
request earns a real 401 rather than one the hook had already authorized.

A transaction that **updates the identity it authenticated as** is the same problem in
another shape: it rewrites the credentials that authorized it. Send the existing secret back
unchanged and vary some other field, so the identity survives for every later request.

## One file

Each hook file is evaluated on its own, so a `state.ts` imported by two of them produces two
separate copies, and fixtures seeded through one are invisible to the other — silently, with
no diagnostic. Keep every hook that shares state in a single file.

## Hitting a declared status

A negative status is earned, not asked for. The server checks in **precedence** order and
answers on the first failure, so landing on one status means satisfying every check before
it. A common order:

```
auth (401) → existence (404) → entitlement (403) → schema (400) → conflict (409)
```

Read the real order off the handler; it varies. Framework schema validation usually runs
after authentication but before the handler body, so a 400 still needs valid credentials.

**Entitlement splits in two, and one identity cannot produce both:**

- **ownership** — authenticated, the resource exists, it belongs to someone else. Needs a
  second identity of the _same_ role, so the role is not what was refused.
- **role** — authenticated, but not permitted at all. Needs an identity of a lesser role.

So a run typically carries three identities: a primary, a same-role second, and a
lesser-role one — plus one more per transaction that rewrites or loses its own credentials.

## Placeholders are structurally valid

Where the description cannot supply a value, the projected sample invents one: `0` for an
integer, `"string"` for a string, a property per open slot. Each is schema-shaped and
semantically wrong, which is why some placeholders fail loudly and others do not:

- A placeholder foreign key inserts cleanly wherever referential integrity is unenforced, so
  the mistake surfaces later as an empty relation rather than an error. Use a real id.
- A closed request schema (`additionalProperties: false`) rejects a sample carrying invented
  properties. Replace the body whole with `utils.setBody(...)` rather than patching fields.
- A placeholder path parameter reaches no row — which is what makes the 404 case free and the
  200 case work.

## Noise in `thymian test`

Some findings are engine defects rather than hook faults. Recognise these instead of chasing
them; both are tracked in the workspace queue.

- Any skip from `rfc9110/server-must-send-www-authenticate-header-for-401-response` whose
  received status is `401`. The rule strips credentials itself, after the hooks have run, so
  no hook can affect it. (#197)
- `sender-should-generate-content-type-for-message-with-content` and
  `origin-server-should-send-content-length-when-size-known` reporting headers absent from a
  response that carries them. The condition is evaluated against the description, which
  cannot declare either header, and never re-checked against the response. (#198)

Confirm the second with `curl -sD- -o /dev/null <url>` before spending time on it.

A finding can also be a real defect in the API or its description that no hook can fix — a
response body that contradicts its own schema, say. Report those; do not shape them away.
