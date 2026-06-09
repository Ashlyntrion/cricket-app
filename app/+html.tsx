import { ScrollViewStyleReset } from 'expo-router/html';

export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover" />

        {/* PWA manifest */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#22c55e" />

        {/* iOS "Add to Home Screen" support */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Cricket Coach" />
        <link rel="apple-touch-icon" href="/favicon.png" />

        <style>{`
          html {
            -webkit-text-size-adjust: 100%;
            height: -webkit-fill-available;
          }
          body {
            margin: 0;
            padding: 0;
            min-height: 100vh;
            min-height: -webkit-fill-available;
            min-height: 100dvh;
          }
          #root {
            height: 100vh;
            height: 100dvh;
            overflow: hidden;
          }
          /* Space for floating tab bar */
          .tab-content { padding-bottom: 90px; }
        `}</style>

        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
