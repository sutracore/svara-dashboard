# 06 — Environment credentials, Cloudflare, and email

[Documentation index](INDEX.md) · Previous: [Stripe](05-stripe-configuration.md) · Next: [Installation and ZIP](07-installation-and-zip-release.md)

## 1. Locate and create `.env`

The local `.env` file belongs in the **application root beside `package.json`**, not inside `app`, `public`, or `docs`. Enable **View → Show → File name extensions** in Windows Explorer so the file does not accidentally become `.env.txt`.

From the extracted application folder:

```powershell
Copy-Item -LiteralPath '.\docs\config\.env.example' -Destination '.\.env'
```

Use this command only when creating a new `.env`; open an existing file for editing instead of overwriting it. Fill in customer-owned values using a text editor or your hosting provider's environment-variable settings. Keep real credentials in the customer's secret store and transfer them separately from the source ZIP. Do not put server secrets in variables beginning with `NEXT_PUBLIC_`: those values can be included in browser code.

## 2. Database and authentication values

| Variable | Required for | Where the value comes from |
| --- | --- | --- |
| `POSTGRES_USER` | Bundled Docker database | Choose the database username before the first container initialization |
| `POSTGRES_PASSWORD` | Bundled Docker database | Generate a unique database password and save it privately |
| `POSTGRES_DB` | Bundled Docker database | Choose the database name, for example `svara` |
| `POSTGRES_PORT` | Local Docker port mapping | Choose an unused host port; default is `5432` |
| `DATABASE_URL` | App and Drizzle, always | PostgreSQL provider's connection details, or the local Docker credentials above |
| `BETTER_AUTH_SECRET` | Authentication | Generate a random secret locally; it is not issued by Cloudflare or Stripe |
| `BETTER_AUTH_URL` | Server auth base and email links | Local origin or customer's deployed HTTPS origin |
| `NEXT_PUBLIC_BETTER_AUTH_URL` | Browser auth client | Same application origin |
| `NEXT_PUBLIC_APP_URL` | Billing/onboarding return links | Same application origin |
| `NEXT_PUBLIC_SITE_URL` | Canonical URLs, sitemap, social metadata | Customer's public HTTPS origin; otherwise source defaults to a SutraCore domain |
| `NEXT_PUBLIC_BASE_URL` | Legacy `/auth/join` server request | Same origin when supporting this legacy page; invitation emails currently point to sign-in |
| `NEXT_PUBLIC_TEST_EMAIL` | Optional demo form prefill | Leave blank in production; never use a real private account as a public prefill |
| `NEXT_PUBLIC_TEST_PASSWORD` | Optional demo form prefill | Leave blank in production; this is public browser configuration, never a secret store |

Generate the authentication secret locally:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Paste the output into `BETTER_AUTH_SECRET` privately. Keep it stable across deployments and instances; a change can invalidate authentication state or make protected authentication data unusable. A database restore involving existing authentication data also needs the matching secret and an appropriate recovery plan.

Example local database URL:

```dotenv
DATABASE_URL=postgresql://svara_user:URL_ENCODED_PASSWORD@localhost:5432/svara
```

URL-encode characters such as `@`, `:`, `/`, `#`, or `%` in the URL's password. A hosted database provider may supply SSL parameters; preserve its required connection/TLS settings. Inside an application container on the same Compose network, the database hostname would be `postgres`; this repository's Compose file starts **only PostgreSQL**, so the documented local app process uses `localhost`.

Changing `POSTGRES_PASSWORD` in `.env` after a Docker data volume has been initialized does not itself change the password already stored in PostgreSQL. Use an explicit database credential-rotation procedure.

## 3. Cloudflare R2: create storage and credentials

![Official Cloudflare R2 authentication reference](screenshots/22-cloudflare-r2-reference.jpg)

This is a public documentation capture, not the customer's Cloudflare account.

1. In the customer's Cloudflare account, enable **R2 Object Storage** and create a bucket for application images.
2. Copy the account ID, not a website zone ID, into `CLOUDFLARE_ACCOUNT_ID`.
3. From R2 account details, open API-token management. Create a token with **Object Read & Write** restricted to this bucket.
4. Save the returned S3 **Access Key ID** as `R2_ACCESS_KEY_ID` and **Secret Access Key** as `R2_SECRET_ACCESS_KEY`. Store the secret when it is displayed; it cannot be retrieved again later.

See [Cloudflare R2 authentication](https://developers.cloudflare.com/r2/api/tokens/).

| Variable | What to enter |
| --- | --- |
| `CLOUDFLARE_ACCOUNT_ID` | Account identifier used to build the R2 S3 endpoint |
| `R2_ACCESS_KEY_ID` | R2 S3-compatible access key ID |
| `R2_SECRET_ACCESS_KEY` | Matching S3 secret key, not a generic Cloudflare API token |
| `R2_BUCKET` | Exact bucket name |
| `R2_PUBLIC_URL` | Public image base URL, with `https://` and no trailing slash |
| `R2_PREFIX` | Optional folder prefix such as `SvaraAI`, without leading/trailing slashes |

The app builds the default endpoint `https://ACCOUNT_ID.r2.cloudflarestorage.com` in `lib/s3.ts`. Jurisdiction-specific buckets need a matching endpoint code change; this version has no endpoint override variable.

## 4. Cloudflare R2: make application images accessible

Attach a customer-controlled custom domain such as `assets.customer.example` to the bucket and use `https://assets.customer.example` as `R2_PUBLIC_URL`. For development, an enabled `r2.dev` URL can be used. Cloudflare describes `r2.dev` as a development access method; use a custom domain for production. Public bucket contents are accessible to visitors who know the object URL. See [Cloudflare public buckets](https://developers.cloudflare.com/r2/buckets/public-buckets/).

The server writes images under a key like `SvaraAI/workspace-logos/USER_ID/TIMESTAMP.png`. Both profile pictures and workspace logos use this upload endpoint. The returned URL is `R2_PUBLIC_URL` plus that key; do not add the bucket name or prefix a second time to the base URL.

If using a new custom hostname, have the developer add it to `images.remotePatterns` in `next.config.ts` before building. The current list allows `*.r2.dev`, `cdn.sutracore.space`, and the QR-image provider. Uploads go **browser → app `/api/upload` → R2**; this flow does not need browser-to-R2 upload CORS configuration.

Verify with a small image upload in Profile, save the profile, and confirm the returned image URL opens in a browser. A successful write with a broken image usually points to the public URL, public-access settings, object path, or image-host allowlist.

## 5. Resend email: domain and sender

![Official Resend domain reference](screenshots/23-resend-domain-reference.jpg)

This application uses **Resend's API**, not SMTP. Adding `SMTP_HOST`, `SMTP_USER`, or `SMTP_PASSWORD` will not configure its email sender.

In the customer's [Resend Domains](https://resend.com/domains), add a sending domain/subdomain. Publish the DNS records Resend supplies at the domain's DNS provider, then wait for verification. Use the exact requested records and avoid replacing unrelated mail records. See [Verified domains](https://resend.com/docs/dashboard/domains/introduction).

Create a dedicated sending API key in [Resend API Keys](https://resend.com/api-keys) and store it as `RESEND_API_KEY`. Use a verified-domain sender such as `Svara AI <no-reply@mail.customer.example>` for `RESEND_FROM_EMAIL`. Keep the API key private; see [Resend API key management](https://resend.com/docs/dashboard/api-keys/introduction).

```dotenv
RESEND_API_KEY=re_replace_with_customer_sending_key
RESEND_FROM_EMAIL="Svara AI <no-reply@mail.customer.example>"
```

The sender address is a From identity; setting it does not create an inbox. Email links use `BETTER_AUTH_URL`, so production emails must not point to localhost. The currently connected sender functions deliver OTP and workspace invitation emails. Other files under `emails/` are templates and should not be assumed to send automatically.

Verify email delivery with an agreed test recipient: request a verification/reset OTP and invite a teammate, then inspect Resend logs. `bun run email:dev` opens a local template preview on port 3001; previewing a template does not prove successful delivery.

## 6. Stripe and unused historical variables

The runtime uses `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO_MONTHLY_ID`, and optional `STRIPE_PRICE_ENTERPRISE_MONTHLY_ID`. See document 05 for where to obtain each.

Historical `.env` files may also contain `STRIPE_PRICE_FREE_MONTHLY_ID`, `STRIPE_PRODUCT_FREE_ID`, `STRIPE_PRODUCT_PRO_ID`, and `STRIPE_PRODUCT_ENTERPRISE_ID`. These are not read by the current app runtime; they are outputs of the optional Stripe setup helper. Migration-only variables such as `OLD_R2_*`, `OLD_CLOUDFLARE_ACCOUNT_ID`, `NEW_DATABASE_URL`, and `POSTGRES_CONTAINER` belong to the migration helper, not routine app startup.

Use one definition per variable. Remove duplicate assignments when preparing the customer's configuration, especially duplicate app URLs and Stripe price IDs.

## 7. Apply environment changes

Stop and restart the local Next.js process after editing `.env`. In production, update the hosting environment and redeploy/restart. Set `NEXT_PUBLIC_*` variables **before the build**; changing a runtime value alone may leave the old origin embedded in the client bundle. Keep all URL origins consistent and omit trailing slashes.

Implementation references: `lib/db.ts`, `drizzle.config.ts`, `docker-compose.yml`, `lib/auth.ts`, `lib/auth-client.ts`, `lib/s3.ts`, `lib/resend.ts`, `lib/seo.ts`, and `next.config.ts`.

## Code examples and source locations

### Where runtime credentials are read

```ts
// lib/db.ts — database connection source.
const databaseUrl = process.env.DATABASE_URL;

// lib/resend.ts — server-only email configuration.
const resendApiKey = process.env.RESEND_API_KEY;
const resendFromEmail = process.env.RESEND_FROM_EMAIL;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

// lib/s3.ts — public image path settings, separate from secret access keys.
export const R2_BUCKET = process.env.R2_BUCKET ?? "";
export const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL ?? "";
```

These are excerpts from separate files. Preserve their existing imports and validation. Local values come from the root `.env`; the host supplies corresponding environment variables in production. There is no settings-panel form that writes these credentials.

### Allow a new customer image hostname

After connecting the customer's R2 public domain, add its hostname to the existing `images.remotePatterns` array in `next.config.ts`. This is a customization example; keep the other required entries:

```ts
{
  protocol: "https",
  hostname: "assets.customer.example",
},
```

Set `R2_PUBLIC_URL=https://assets.customer.example` separately in the environment. The allowlist entry takes only the hostname, while the environment value includes the protocol. Rebuild/redeploy after changing the Next.js configuration.

### Customize email subjects

`lib/resend.ts` contains the existing OTP subject map. Edit the human-readable values, keeping the type keys unchanged:

```ts
const emailSubjectByType: Record<OtpEmailType, string> = {
  "sign-in": "Your sign-in OTP code",
  "email-verification": "Verify your email address",
  "forget-password": "Reset your password with OTP",
  "change-email": "Confirm your email change",
};
```

Email sender identity is `RESEND_FROM_EMAIL`; email layout, logo, wording, and inline colors are customized in `emails/`. See [Branding and app configuration](09-branding-and-app-configuration.md).
