// Bundled inspiration only. Never use these selectors for customer/project/proposal images.
export const welcomeImages = [
  {
    src: "/images/interior.jpg",
    highRes: "/images/interior-4k.webp",
    alt: "Original architectural interior illustration in muted green",
    source: "Original community illustration",
  },
  {
    src: "/images/living.jpg",
    highRes: "/images/living-4k.webp",
    alt: "Original illustration of a modern living space",
    source: "Original community illustration",
  },
  {
    src: "/images/architectural-exterior.jpg",
    highRes: "/images/architectural-exterior-4k.webp",
    alt: "Original architectural home exterior illustration",
    source: "Original community illustration",
  },
  {
    src: "/images/architectural-living.jpg",
    highRes: "/images/architectural-living-4k.webp",
    alt: "Original warm interior illustration",
    source: "Original community illustration",
  },
] as const;
export function chooseWelcomeImage(
  random: number = crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296,
) {
  return welcomeImages[
    Math.min(
      welcomeImages.length - 1,
      Math.max(0, Math.floor(random * welcomeImages.length)),
    )
  ];
}
