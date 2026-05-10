declare module '*.sql?raw' {
  const content: string;
  export default content;
}

declare module '*.css';

// Forge Vite plugin defines these globals at build time for the renderer entry point.
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;
