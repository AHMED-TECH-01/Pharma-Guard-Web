import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'PharmaGuard',
    template: '%s · PharmaGuard',
  },
  description:
    'Web-only, multi-tenant pharmacy expiry, inventory, safety-support and compliance platform.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Applies device-local appearance prefs before first paint (Settings > Appearance). */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var a=JSON.parse(localStorage.getItem('pg.appearance')||'{}');var d=document.documentElement;if(a.reduceMotion){d.classList.add('pg-reduce-motion');}if(a.compactTables){d.classList.add('pg-compact');}}catch(e){}",
          }}
        />
      </head>
      <body className="min-h-dvh bg-background font-sans text-text antialiased">{children}</body>
    </html>
  );
}
