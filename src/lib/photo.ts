/**
 * Shrinks a photo to a JPEG data URL small enough to sync (Firestore documents max out at 1 MB,
 * and a workout can carry a few photos): longest side `maxSide`, quality lowered until it fits.
 */
export async function fileToJpeg(file: File, maxSide = 960, maxBytes = 170_000): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    let side = maxSide;
    for (let attempt = 0; attempt < 6; attempt++) {
      const scale = Math.min(1, side / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.round(img.naturalWidth * scale);
      const h = Math.round(img.naturalHeight * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const g = canvas.getContext('2d')!;
      g.imageSmoothingQuality = 'high';
      g.drawImage(img, 0, 0, w, h);
      for (const q of [0.78, 0.68, 0.58, 0.5]) {
        const data = canvas.toDataURL('image/jpeg', q);
        if (data.length * 0.75 <= maxBytes) return data;
      }
      side = Math.round(side * 0.8);
    }
    throw new Error('Photo too large');
  } finally {
    URL.revokeObjectURL(url);
  }
}

export const MAX_WORKOUT_PHOTOS = 3;
