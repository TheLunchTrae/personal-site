import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { SiteFooter } from '@/site/site-footer';
import { SiteHeader } from '@/site/site-header';
import { PlayLayer } from '@/themes/play-layer';
import { themeBootScript } from '@/themes/registry';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
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
