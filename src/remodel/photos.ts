// Decode on the device where possible (including formats Safari can decode), strip EXIF/location and bound upload size.
export async function uploadablePhoto(file: File): Promise<string> {
  if (
    file.type &&
    ![
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/heic",
      "image/heif",
    ].includes(file.type)
  )
    throw Error("Choose a JPEG, PNG, WebP or a supported iPhone HEIC photo.");
  if (file.size > 20 * 1024 * 1024) throw Error("Choose a photo under 20 MB.");
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode().catch(() => {
      throw Error(
        "This browser cannot open the photo. Export HEIC as JPEG, or choose a JPEG, PNG or WebP.",
      );
    });
    if (img.naturalWidth * img.naturalHeight > 40000000)
      throw Error("Choose a photo smaller than 40 megapixels.");
    const ratio = Math.min(
        1,
        1600 / Math.max(img.naturalWidth, img.naturalHeight),
      ),
      canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * ratio);
    canvas.height = Math.round(img.naturalHeight * ratio);
    const context = canvas.getContext("2d");
    if (!context) throw Error("Photo decoding unavailable.");
    context.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.92).split(",")[1];
  } finally {
    URL.revokeObjectURL(url);
  }
}
