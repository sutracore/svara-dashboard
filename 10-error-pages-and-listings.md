# Error pages and listing demos

The workspace sidebar includes **Grid Listing**, **Remote Table**, and **Error
Pages** under Pages.

[Documentation index](INDEX.md)

![Standalone maintenance-page preview](screenshots/25-maintenance.jpg)

## Error and maintenance pages

`/error-pages` previews 401, 403, 404, 408, 429, 500, 502, 503, and maintenance
states. Each preview is available at `/error-pages/{code}`, including
`/error-pages/maintenance`. Previews do not deliberately fail requests.

Unknown URLs use the custom 404 page. Root, workspace, and global error
boundaries provide the 500 fallback with a retry action. Production error
digests appear as a reference when supplied by Next.js; internal exception
messages are not displayed.

`/maintenance` is a public standalone maintenance page. Visiting this route
does not enable site-wide maintenance mode.

The shared page copy lives in `lib/error-pages.ts`, and the presentation lives
in `components/common/error-state.tsx`.

## Grid listing

`/listings/grid` browses 120 local sample episodes with search, category/status
filters, page sizes (6, 12, or 24), first/last navigation, direct page jumps,
and episode details. Search and filter changes return to the first page.

## Remote table

`/listings/table` fetches synthetic data from `/api/demo/episodes`, with server
pagination over **10,000,000 records (10000K)**. Only the requested page is
generated and sent. The complete dataset is never loaded into the browser.

The generator indexes a repeating pattern of searchable attributes to count
and filter results without iterating through ten million records. Searching,
filtering, ID sorting, and page jumps apply to the complete dataset.

The public API returns generated demo records only. It does not read workspace
or account data and does not require a database migration or external service.
The workspace pages retain the existing sign-in and onboarding requirements.

| Parameter | Values |
| --- | --- |
| `page` | Positive safe integer; defaults to 1, clamped to the last matching page |
| `pageSize` | 10, 25, 50, or 100; defaults to 25 |
| `q` | Up to 80 characters: title, host, category, or exact ID such as `EP-10000000` |
| `status` | `all`, `Published`, `Draft`, or `Scheduled` |
| `category` | `all`, `Technology`, `Business`, `Culture`, or `Wellness` |
| `direction` | `asc` or `desc`, sorted by episode ID |

Responses include `data`, `pagination` (page, pageSize, total, totalPages,
start, end), and `datasetTotal`. Invalid parameters return HTTP 400.
The table includes loading, zero-result, timeout, and retry states, and cancels
superseded requests. Searching is debounced by 300 ms.

## Code examples and source locations

Error copy and presentation are in `lib/error-pages.ts` and
`components/common/error-state.tsx`. Listing pages are under
`app/(workspace)/listings/`; the synthetic API is `app/api/demo/episodes/route.ts`.

Example requests:

```text
/api/demo/episodes?page=400000&pageSize=25
/api/demo/episodes?q=EP-10000000
/api/demo/episodes?category=Wellness&status=Scheduled&direction=desc
```

## Verification

```powershell
bun test lib/server/demo-listings.test.ts
bunx tsc --noEmit
bun run build
```

The pagination tests cover response size, the ten-millionth record, reverse
sorting, combined filters across full/partial pattern cycles, exact-ID search,
empty results, invalid inputs, and bounded navigation buttons.
