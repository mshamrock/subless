import Script from "next/script";

const MEASUREMENT_ID = "G-TD3E63VM7M";

/**
 * Google Analytics, on the production site only.
 *
 * Local development and preview deployments would otherwise report as real
 * traffic — every reload while building a page, every link opened from a pull
 * request — and the first weeks of a site with one user are exactly when that
 * noise would swamp the signal.
 *
 * Client-side navigations need no extra code: GA4's enhanced measurement counts
 * history changes as page views on its own.
 */
export function GoogleAnalytics() {
  if (process.env.VERCEL_ENV !== "production") return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${MEASUREMENT_ID}');
        `}
      </Script>
    </>
  );
}
