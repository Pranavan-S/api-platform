---
type: Feature
title: API publishing to API Portals
description: A publisher can prepare how an API appears on each API Portal, keep it as a draft, and publish, republish, unpublish or deprecate it from the console.
resource: /platform-api
tags: [platform-api, api-control-plane, api-portal, publishing]
status: draft
sources:
  - id: handler
    resource: /platform-api/internal/handler/api_publication.go
    title: Publication routes, body size caps and response mapping
  - id: service
    resource: /platform-api/internal/service/publication.go
    title: Draft save, publish, unpublish, deprecate and the portal status list
  - id: definition-validation
    resource: /platform-api/internal/service/publication_definition_validation.go
    title: Per-API-type definition validators applied at publish
  - id: documents
    resource: /platform-api/internal/service/publication_documents.go
    title: Document resolution and placement in the content archive
  - id: portal-publisher
    resource: /platform-api/internal/service/portal_publisher.go
    title: Contract for pushing a publication to an API Portal
  - id: portal-content
    resource: /platform-api/internal/service/portal_content.go
    title: Content archive layout and the portal's size limits
  - id: http-publisher
    resource: /platform-api/internal/service/http_portal_publisher.go
    title: Listing push, unpublish, deprecate and portal error mapping
  - id: http-plans
    resource: /platform-api/internal/service/http_portal_plans.go
    title: Portal plan listing and plan sync
  - id: http-meters
    resource: /platform-api/internal/service/http_portal_meters.go
    title: Portal meter sync and undo of a plan sync
  - id: http-content
    resource: /platform-api/internal/service/http_portal_content.go
    title: Content archive push
  - id: repository
    resource: /platform-api/internal/repository/publication.go
    title: Draft and live listing storage, promotion and selection copies
  - id: model
    resource: /platform-api/internal/model/publication.go
    title: Publication, content and selection model
  - id: markdown-sanitizer
    resource: /platform-api/internal/utils/markdown_sanitizer.go
    title: Removes embedded HTML from the landing page
  - id: schema
    resource: /platform-api/internal/database/schema.sqlite.sql
    title: api_publications and its three satellite tables
  - id: config
    resource: /platform-api/config/config.go
    title: Portal call timeouts, the publish worst case check and the content size caps
  - id: default-config
    resource: /platform-api/config/default_config.go
    title: Default portal call timeouts, including the 65 s overall deadline
  - id: console-api
    resource: /portals/api-control-plane/src/api/resources/apiPublications/
    title: Console client for the publication endpoints
  - id: console-pages
    resource: /portals/api-control-plane/src/pages/appShell/appShellPages/portals/
    title: Portal list and the shared publish page
  - id: e2e
    resource: /tests/framework/suites/it/features/apiportal/publishing/publication_lifecycle.feature
    title: End-to-end lifecycle against a real API Portal
---

# API publishing to API Portals

**Status**: In progress.

Before this feature an API in Platform API could not be put on an API Portal from the console. A publisher now keeps, per API and per portal, one draft and at most one live listing. The draft holds the details, definition, subscription plans, documents, landing page and thumbnail. Publish pushes the draft to the portal and makes it the live listing. Unpublish and deprecate act on the live listing. The boundary to keep in mind: this feature only references an API's documents by handle; serving and managing the documents themselves belongs to the API documentation feature. It covers REST and GraphQL APIs.

The document has two parts. **Product view** answers what the feature does, why it is shaped this way and what it does not do. **Developer view** answers where the code is and how to try it. Nothing in the product view names a file; nothing in the developer view re-explains a use case.

---

## Product view

### Use cases

| # | Actor | Wants to | So that | Status |
|---|---|---|---|---|
| UC1 | Publisher | See every portal with the API's status on it | They know where the API is listed and where a draft is waiting | Done |
| UC2 | Publisher | Edit details, definition, plans, documents, landing page and thumbnail, and save them as a draft | Work in progress survives reloads and failed publishes | Done |
| UC3 | Publisher | Open the editor already filled from the latest values | A first publish needs no retyping and a republish keeps earlier edits | Done |
| UC4 | Publisher | Offer subscription plans the portal does not have yet | Consumers can subscribe without anyone creating plans on the portal by hand | Done |
| UC5 | Publisher | Publish, and later republish, the draft | Consumers see the API and its changes on the portal | Done |
| UC6 | Publisher | Unpublish the API | It leaves the portal while the work is kept | Done |
| UC7 | Publisher | Deprecate the API | Consumers are warned while the listing stays | Done |
| UC8 | Publisher | See which plans and documents changed or were deleted since publishing | They know when a republish is needed | Done |

### Decisions

| Decision | Choice | Why |
|---|---|---|
| Where does the editor get its values? | The draft first, then the live listing, then the API. A draft wins even over a newer live listing | A draft is the latest editing intent, so skipping it would lose edits |
| What is the default production URL? | The first gateway URL the API is deployed at; never the API's backend URL | A backend URL on the portal would send consumers around the gateway |
| What if a stored thumbnail or landing page cannot be read when the editor opens? | Nothing older is substituted | A save would otherwise overwrite the draft's own copy |
| What does publish send? | Exactly what the draft holds. The console saves the draft first, and does not publish when the definition did not save | Save Draft and Publish can never disagree about what goes live |
| When is the definition checked? | Only at publish, never on save. For REST APIs it must be a complete OpenAPI 3.x document in JSON or YAML, checked the same way as in the API's own editor. Enforced by tests that save any content as a draft and refuse a missing or invalid definition at publish | Saving half-done work must never be blocked |
| What is the order of a publish? | Plans on the portal first, then the listing, then documents, thumbnail and landing page. Nothing in the console changes unless the portal accepted the listing | A failed publish leaves the console exactly as it was |
| What if the listing push fails after plans were created? | The plans and meters this publish created on the portal are removed again | A failed publish should not leave new billing objects behind |
| What if the draft is saved while it is being published? | Nothing is promoted and the publisher is told the draft changed. Enforced by a test that saves during the push | Content the portal never received must not be marked live |
| Does the listing keep one identity? | Yes. Publish, republish, unpublish and deprecate never replace it | Anything referring to "this API on this portal" stays valid |
| What happens to the draft on unpublish? | A draft always remains. If a newer draft exists, its edits win and the live content is discarded | Unpublishing must not cost the publisher their work |
| What does deprecate change? | Only the status, on the portal and in the console. The draft is untouched | Deprecation is a signal, not an edit |
| Which plans can a draft offer? | Active plans only, checked on save and on publish | The portal has no plan status and would sell an inactive plan as a normal one |
| How are plans matched with the portal's? | By exact, case-sensitive handle. A portal copy with another name or limit is updated; one priced differently blocks the publish | The portal cannot change a plan's price once created |
| What happens when a selected plan or document is deleted? | The listing keeps its stored name and shows it as deleted. A deleted plan blocks publish; a deleted document is left out | Consumers may still hold subscriptions on the portal, so the record must survive |
| How are later edits shown? | The published view tags a plan or document "Edited" when it changed after the last publish. The draft view never does, since it always shows the current source | The publisher can tell when a republish is needed |
| What is the time limit? | 65 s for all portal calls of one request, under the console's 70 s. Each call gets two attempts. Platform API refuses to start with a limit below a publish's worst case | The publisher always gets an answer before the console gives up |
| What does the publisher see when the portal refuses? | A short reason from a fixed list (for example "active subscriptions are removed"), never the portal's own text. A refused credential reads as "portal unavailable" | Portal internals must not leak, and a credential problem is not something the publisher can fix |
| Can permission to publish one API type cover another? | No. Each type has its own release permission, and permission to edit an API does not grant release | Releasing to a portal is a separate responsibility |
| Is there publish history? | No. A republish replaces the live content; there is no rollback | Not needed for the first release |

### Scope

In scope:

- The portal list with the API's status per portal.
- One draft per API per portal: details, definition, plans, documents, landing page (Markdown) and thumbnail (PNG or JPEG).
- Pre-filling the editor from the latest values.
- Publish, republish, unpublish and deprecate.
- Creating missing plans, and the meters their prices use, on the portal at publish.
- Showing edited and deleted plans and documents on the published view.
- REST and GraphQL APIs.

Out of scope:

- Serving or managing an API's documents, definition or thumbnail outside a publication.
- Publish history and rollback.
- WebSub, WebBroker, MCP and LLM API types.
- Asynchronous publishing.

### Current limitations

| Limitation | Impact | Tracking |
|---|---|---|
| Deselecting a document, or clearing the thumbnail or landing page, does not remove it from the portal | Consumers still see removed content until it is removed on the portal | Not yet filed |
| After the listing push succeeds, a failed content push, a failed local save or a "draft changed" answer leaves the portal ahead of the console | The portal shows content the console does not list as live, until the next publish | Not yet filed |
| Tags, labels and owners are accepted by the API but not shown in the console, and a console save clears them | Values set through the API are lost on the next console save | Not yet filed |
| A publish that times out after the portal accepted the listing cannot remove the plans it created | Unused plans stay on the portal; a warning is logged | Not yet filed |
| A listing create retried after a lost reply can be refused as a conflict | The publisher sees a conflict for a publish that in fact went through | Not yet filed |
| A deprecated listing still accepts new subscriptions on the portal | Deprecation is only a badge for consumers | Not yet filed |

### Open questions

| Question | Options | Owner | Needed by |
|---|---|---|---|
| How should a console save treat tags, labels and owners? | Show and edit them in the console (recommended); or keep stored values when the save omits them | Not yet assigned | Before release |
| Should a refused portal credential get its own error? | A dedicated "portal authentication failed" error (recommended); or keep "portal unavailable" | Not yet assigned | Before release |
| Should a listing create be retried after a lost reply? | Check for the listing before retrying (recommended); or stop retrying creates | Not yet assigned | Before release |
| Should deprecation stop new subscriptions? | Ask the portal to refuse new subscriptions to a deprecated listing; or keep it a badge | Not yet assigned | Before release |

---

## Developer view

### Entry points

Ordered the way a reader should explore. Every `sources` entry appears here. Rows marked "(shared, not tracked)" are for orientation only and are not in `sources`.

| Start here | Path | What you will find |
|---|---|---|
| Contract (shared, not tracked) | `platform-api/resources/openapi.yaml` | The `API Publications` tag: shared draft and listing paths, per-type publish, unpublish and deprecate paths, scopes |
| HTTP | `platform-api/internal/handler/api_publication.go` | Routes, body size caps, the per-type lifecycle routes, `sourceStatus` mapping |
| Logic | `platform-api/internal/service/publication.go` | Draft validation, publish order, deleted-plan and deleted-document rules, unpublish, deprecate, the portal status list |
| Logic | `platform-api/internal/service/publication_definition_validation.go` | The validator registry; a type with no entry cannot be published |
| Logic | `platform-api/internal/service/publication_documents.go` | Document lookup, path safety and clash checks |
| Portal contract | `platform-api/internal/service/portal_publisher.go` | What a portal push must do and its error types |
| Portal push | `platform-api/internal/service/http_portal_publisher.go` | Create-or-update by handle, deprecate, unpublish, error-to-reason mapping |
| Portal push | `platform-api/internal/service/http_portal_plans.go` | Plan listing, create, update and pricing check |
| Portal push | `platform-api/internal/service/http_portal_meters.go` | Meter sync and the undo after a failed listing push |
| Portal push | `platform-api/internal/service/portal_content.go` | Content ZIP layout and the mirrored portal limits |
| Portal push | `platform-api/internal/service/http_portal_content.go` | The content ZIP upload |
| Storage | `platform-api/internal/repository/publication.go` | Draft save, promotion, the merge onto the live row, selection copies |
| Model | `platform-api/internal/model/publication.go` | Publication, content and selection types |
| Sanitizing | `platform-api/internal/utils/markdown_sanitizer.go` | Landing-page HTML removal |
| Schema | `platform-api/internal/database/schema.sqlite.sql` | `api_publications`, `api_publication_contents`, `api_publication_plan_mappings`, `api_publication_doc_mappings` (other dialects change with it) |
| Config | `platform-api/config/config.go` | `api_portal_publication` timeouts, the publish worst-case check, `publication_*_max_bytes` |
| Config | `platform-api/config/default_config.go` | The default timeouts: 5 s per attempt, 10 s for content, 1 retry, 1 s backoff, 65 s overall |
| Config (shared, not tracked) | `platform-api/config/config-template.toml` | The same keys with their documented defaults |
| Plans (shared, not tracked) | `platform-api/internal/service/subscription_plan_service.go` | A plan offered by a publication counts as in use |
| Console | `portals/api-control-plane/src/api/resources/apiPublications/` | Endpoints, hooks and queries for the publication API |
| Console | `portals/api-control-plane/src/pages/appShell/appShellPages/portals/` | Portal list, the shared publish page, pre-fill, tabs and the per-type target |
| Tests | `tests/framework/suites/it/features/apiportal/publishing/publication_lifecycle.feature` | Executable specification of publish, republish, deprecate and unpublish |

A new API type needs entries in the validator registry, the portal listing kinds in `http_portal_publisher.go`, the publishable types in `api_publication.go`, a scope in the contract, and a publish target in the console's `publishTarget.ts`. The storage and the shared pages need no change.

### Examples

```bash
# Save a draft for a REST API on a portal, then its definition.
curl -X PUT "$PLATFORM_API/api/v0.9/api-portals/$PORTAL/apis/rest-api/$API/draft" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"displayName":"Loans API","version":"v1.0","subscriptionPlanIds":["gold"],"docIds":[]}'
curl -X PUT "$PLATFORM_API/api/v0.9/api-portals/$PORTAL/apis/rest-api/$API/draft/definition" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/yaml" --data-binary @openapi.yaml

# Publish (201 when nothing is live, including after an unpublish; 200 when replacing a live listing), then check the status on every portal.
curl -X POST "$PLATFORM_API/api/v0.9/api-portals/$PORTAL/apis/rest-api/$API/publish" -H "Authorization: Bearer $TOKEN"
curl "$PLATFORM_API/api/v0.9/api-publications?apiType=rest-api&apiId=$API" -H "Authorization: Bearer $TOKEN"

# Deprecate, then unpublish (204); a draft remains.
curl -X POST "$PLATFORM_API/api/v0.9/api-portals/$PORTAL/apis/rest-api/$API/deprecate" -H "Authorization: Bearer $TOKEN"
curl -X POST "$PLATFORM_API/api/v0.9/api-portals/$PORTAL/apis/rest-api/$API/unpublish" -H "Authorization: Bearer $TOKEN"
```
