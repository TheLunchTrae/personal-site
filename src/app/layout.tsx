import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import { colorModeBootScript } from '@/site/color-mode';
import { SiteFooter } from '@/site/site-footer';
import { SiteHeader } from '@/site/site-header';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Trae',
  description: 'Personal site of Trae, software engineer.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    // The boot script sets the stored color mode before hydration, so it may differ from the server's.
    <html lang="en" data-color-mode="system" suppressHydrationWarning className={`${geistSans.variable} antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: colorModeBootScript }} />
      </head>
      <body>
        <a href="#content" className="skip-link">
          Skip to content
        </a>
        <SiteHeader />
        <main id="content" className="page" tabIndex={-1}>
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
