import { Html, Head, Main, NextScript } from "next/document";
import brand from "../config/brand.json";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <meta name="theme-color" content={brand.primaryColor} />
        <script src="https://cdn.tailwindcss.com"></script>
        <script
          dangerouslySetInnerHTML={{
            __html: `
tailwind.config = {
  theme: {
    extend: {
      colors: {
        brandPrimary: '${brand.primaryColor}',
        brandDark: '${brand.darkColor}',
        brandAccent: '${brand.accentColor}'
      }
    }
  }
}`
          }}
        />
        <style>{`
          html, body { height: 100%; }
          body { margin: 0; }
        `}</style>
      </Head>
      <body className="min-h-screen bg-brandDark text-slate-100">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
