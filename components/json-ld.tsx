/**
 * Safe JSON-LD injection — payload is authored in source, never user HTML.
 * Uses JSON.stringify which escapes < for XSS safety in script context.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
