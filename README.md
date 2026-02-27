# Progressive Journal

A modern minimalist journaling app built with Next.js, TypeScript, and Tailwind CSS v4.

## Features

- Journal folders
- Journal entries with text
- Image and file uploads per entry
- Voice memo recording and playback
- Bottom navigation for mobile and desktop
- Light/black theme toggle in Profile
- Local persistence via `localStorage`
- PWA install support (manifest + service worker + home-screen icons)

## Run

1. Install Node.js 20+
2. Install dependencies:

```bash
npm install
```

3. Start development server:

```bash
npm run dev
```

4. Open `http://localhost:3000`

## Notes

- Data is stored in browser localStorage.
- Uploaded files and recorded memos are stored as data URLs, so very large files may exceed browser storage limits.
- The app does not send journal content to any backend/cloud service.
