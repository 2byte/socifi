# NTPM Checklist

A to-do list inside a note post. The reference example for writing a module:
it is the base class and nothing else.

```
ntpm-checklist/
├── NtpmChecklistModule.ts  — payload type, validation, WS channel
└── pages/ntpm-main.vue     — the UI the note page mounts
```

- **Payload** — `{ text: string, done: boolean }`, one storage entry per item.
- **HTTP** — everything comes from `NtpmBaseModule`:
  `/api/post/:post_id/internal/checklist/entries` (GET, POST, PUT/:id, DELETE/:id).
- **WS** — channel `checklist:changed`; the page refetches when it fires, so
  several open tabs stay in sync.
- **Page contract** — the host mounts `pages/ntpm-main.vue` with the props
  `{ postId: number, token: string, apiRoot?: string }`; for a guest of a shared link the host also passes `{ role: "guest", readonly }`.

To add a module to a note, create a post and pick the module in the post dialog
(API: `POST /notes/:id/posts` with `moduleSlug: "checklist"`). The post may also have text.
