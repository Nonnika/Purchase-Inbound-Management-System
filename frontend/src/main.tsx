import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'

// IBM Plex family — weights 300/400/600 only (DESIGN.md §3: no bold).
import '@fontsource/ibm-plex-sans/300.css'
import '@fontsource/ibm-plex-sans/400.css'
import '@fontsource/ibm-plex-sans/600.css'
// JetBrains Mono — numeric/code font. Sharper digit glyphs (dotted zero,
// distinct 1/l/I) than Plex Mono for IDs, hash chains, prices, stats.
// Weights 400/600 match the design-system weight palette.
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/600.css'
// 思源黑体 (Source Han Sans / Noto Sans SC) — CJK fallback for Plex Sans.
// Latin glyphs come from Plex; CJK glyphs fall through to Noto Sans SC.
// Weights 300/400/600 match the design-system palette (no 700 bold).
import '@fontsource/noto-sans-sc/300.css'
import '@fontsource/noto-sans-sc/400.css'
import '@fontsource/noto-sans-sc/600.css'

import './styles/tokens.css'
import './styles/global.css'
import { router } from './router'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
