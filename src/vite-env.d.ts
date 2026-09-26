/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Injected by Netlify at build time. Undefined locally. */
  readonly VITE_GIT_COMMIT?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
