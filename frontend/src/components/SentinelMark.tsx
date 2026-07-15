/* "The sentinel" — Karnataka's outline cut out of a shield, watch-eye at
   its core. Generated from the source logo by make_brand_assets.py.

   Served at 96px and displayed at ~26-34px so it stays crisp on retina;
   the dark areas are genuinely transparent, so the state silhouette reads
   as a cut-out against whatever surface it sits on. */
export default function SentinelMark({ size = 26 }: { size?: number }) {
  return (
    <img
      src={`${import.meta.env.BASE_URL}brand/mark-96.png`}
      width={size}
      height={size}
      alt=""
      aria-hidden
      decoding="async"
      style={{ width: size, height: size, objectFit: 'contain', flexShrink: 0 }}
    />
  )
}
