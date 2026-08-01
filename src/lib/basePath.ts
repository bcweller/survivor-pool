// Kept in sync with next.config.js's basePath and the NEXT_PUBLIC_BASE_PATH
// env var. Client code can't rely on Next's automatic basePath handling for
// raw fetch() calls or NextAuth redirect URLs, so anything that isn't a
// next/link or next/navigation call needs this prefix applied explicitly.
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? ''
