import { cn } from "@/lib/utils";

/**
 * Icon for a real product.
 *
 * Brand brief §10: every real product shown in the interface carries its
 * official icon, and where no verified icon exists the name stands alone.
 * A generic monogram beside a real brand reads as a broken image and quietly
 * invents visual identity for a company that did not choose it.
 */
export function TargetIcon({
  logoUrl,
  size = 16,
  className,
}: {
  /** Kept for call-site readability and future alt text. */
  name?: string;
  logoUrl?: string | null;
  size?: number;
  className?: string;
}) {
  if (!logoUrl) return null;

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={logoUrl}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      loading="lazy"
      className={cn("shrink-0 object-contain", size >= 32 ? "rounded-lg" : "rounded", className)}
      style={{ width: size, height: size }}
    />
  );
}
