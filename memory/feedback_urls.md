---
name: Use streamtoshelf.com not vercel.app
description: When referencing the live site URL (e.g. in User-Agent headers or API calls), use streamtoshelf.com not stream-to-shelf.vercel.app
type: feedback
---

Use `https://streamtoshelf.com` as the canonical site URL, not `https://stream-to-shelf.vercel.app`.

**Why:** User corrected this when I used the vercel.app URL in a MusicBrainz User-Agent header.

**How to apply:** Any time the live site URL is needed (User-Agent headers, API calls, metadata, etc.) use streamtoshelf.com.
