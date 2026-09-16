/**
 * The brand mark. Served from /logo.png rather than inlined so the header stays
 * light; the icon routes use the base64 copy because `next/og` needs the bytes.
 */
export function SublessMark({
  size = 32,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src="/logo.png"
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      className={className}
      style={{ width: size, height: size, objectFit: "contain" }}
    />
  );
}
