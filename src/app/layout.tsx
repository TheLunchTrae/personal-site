import type { Metadata } from 'next';
import { Black_Ops_One, Geist, Geist_Mono, Special_Elite, Teko } from 'next/font/google';
import localFont from 'next/font/local';
import { SiteFooter } from '@/site/site-footer';
import { SiteHeader } from '@/site/site-header';
import { PlayLayer } from '@/themes/play-layer';
import { themeBootScript } from '@/themes/registry';
import './globals.css';
import '@/themes/minecraft/minecraft.css';
import '@/themes/geometry-dash/geometry-dash.css';
import '@/themes/call-of-duty/call-of-duty.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

// Only the Minecraft theme uses this face, so it is not preloaded. Minecraft-Font
// by Idrees Hassan, SIL OFL 1.1; the license sits next to the files and is served
// from public/licenses/. The regular file's internal weight class is 500, but it is
// the only regular face, so it is declared as 400 on purpose.
const minecraftFont = localFont({
  variable: '--font-pixel',
  src: [
    { path: '../themes/minecraft/fonts/Minecraft.otf', weight: '400' },
    { path: '../themes/minecraft/fonts/Minecraft-Bold.otf', weight: '700' },
  ],
  preload: false,
});

// Only the Geometry Dash theme uses this face, so it is not preloaded. Pusab by
// Ryoichi Tsunekawa (Flat-it), a freeware font; the license sits next to the file
// and is served from public/licenses/. It ships one weight, used for text only.
const pusab = localFont({
  variable: '--font-dash',
  src: [{ path: '../themes/geometry-dash/fonts/Pusab.woff', weight: '400' }],
  preload: false,
});

// Only the Call of Duty theme uses these three faces, so they are not preloaded.
// Black Ops One by James Grieshaber and Eben Sorkin and Teko by Indian Type
// Foundry are under the SIL OFL 1.1; Special Elite by Astigmatic is under the
// Apache License 2.0. Their licenses are served from public/licenses/.
const blackOpsOne = Black_Ops_One({
  variable: '--font-call-of-duty-title',
  subsets: ['latin'],
  weight: '400',
  preload: false,
});

const teko = Teko({
  variable: '--font-call-of-duty',
  subsets: ['latin'],
  weight: ['400', '600'],
  preload: false,
});

const specialElite = Special_Elite({
  variable: '--font-call-of-duty-type',
  subsets: ['latin'],
  weight: '400',
  preload: false,
});

export const metadata: Metadata = {
  title: 'Trae',
  description: 'Personal site of Trae, software engineer.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    // The boot script sets the theme attributes before hydration, so they may differ from the server's.
    <html
      lang="en"
      data-theme="default"
      data-color-mode="system"
      data-play="off"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${minecraftFont.variable} ${pusab.variable} ${blackOpsOne.variable} ${teko.variable} ${specialElite.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className="flex min-h-full flex-col">
        <a href="#content" className="skip-link">
          Skip to content
        </a>
        <SiteHeader />
        <div className="play-layer">
          <PlayLayer />
        </div>
        <main id="content" className="page" tabIndex={-1}>
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
