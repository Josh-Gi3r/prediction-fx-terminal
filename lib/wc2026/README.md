# lib/wc2026 (event module — example)

This is the WC2026 example event content module.
The canonical location is `lib/events/wc2026/`.

The files here are kept for import compatibility while all `app/wc/` pages
import from `@/lib/wc2026/*`. Both directories are kept in sync.

To add your own event:
1. Create `lib/events/<your-event>/` with an `index.ts`, `data.ts`, and `types.ts`.
2. Create `app/<your-event>/` pages using the wc2026 pages as a reference.
3. Create `components/events/<your-event>/` for your event UI components.
4. Register the event nav item via NEXT_PUBLIC_FEATURE_EVENT_MODULE in .env.
