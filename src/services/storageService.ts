import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "./firebase";

interface CompressedImageResult {
  blob: Blob;
  width: number;
  height: number;
}

export interface UploadedMapAsset {
  url: string;
  width: number;
  height: number;
  originalBytes: number;
  compressedBytes: number;
  contentType: string;
}

const readImageDimensions = (file: File): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
      URL.revokeObjectURL(objectUrl);
    };

    image.onerror = () => {
      reject(new Error("Unable to read image dimensions"));
      URL.revokeObjectURL(objectUrl);
    };

    image.src = objectUrl;
  });
};

const compressImageFile = async (
  file: File,
  quality = 0.75,
  maxWidth = 2400,
  maxHeight = 2400
): Promise<CompressedImageResult> => {
  const source = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      resolve(image);
      URL.revokeObjectURL(objectUrl);
    };

    image.onerror = () => {
      reject(new Error("Failed to decode map image"));
      URL.revokeObjectURL(objectUrl);
    };

    image.src = objectUrl;
  });

  const widthRatio = maxWidth / source.naturalWidth;
  const heightRatio = maxHeight / source.naturalHeight;
  const ratio = Math.min(1, widthRatio, heightRatio);
  const targetWidth = Math.max(1, Math.round(source.naturalWidth * ratio));
  const targetHeight = Math.max(1, Math.round(source.naturalHeight * ratio));

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Failed to initialize image compression canvas");
  }

  context.drawImage(source, 0, 0, targetWidth, targetHeight);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((candidate) => {
      if (!candidate) {
        reject(new Error("Image compression failed"));
        return;
      }
      resolve(candidate);
    }, "image/webp", quality);
  });

  return {
    blob,
    width: targetWidth,
    height: targetHeight,
  };
};

export const StorageService = {
  async uploadCharacterImage(userId: string, file: File) {
    const path = `users/${userId}/characters/${Date.now()}_${file.name}`;
    const storageRef = ref(storage, path);
    const snapshot = await uploadBytes(storageRef, file);
    return getDownloadURL(snapshot.ref);
  },

  async uploadMapImage(userId: string, file: File, campaignId?: string): Promise<UploadedMapAsset> {
    const compressed = await compressImageFile(file, 0.75);
    const originalDimensions = await readImageDimensions(file);
    const safeFileName = file.name.replace(/[^a-zA-Z0-9_.-]/g, "_");
    const baseFolder = campaignId ? `users/${userId}/campaigns/${campaignId}/maps` : `users/${userId}/maps`;
    const path = `${baseFolder}/${Date.now()}_${safeFileName}.webp`;
    const storageRef = ref(storage, path);

    const snapshot = await uploadBytes(storageRef, compressed.blob, {
      contentType: "image/webp",
      customMetadata: {
        originalWidth: String(originalDimensions.width),
        originalHeight: String(originalDimensions.height),
      },
    });

    const url = await getDownloadURL(snapshot.ref);

    return {
      url,
      width: compressed.width,
      height: compressed.height,
      originalBytes: file.size,
      compressedBytes: compressed.blob.size,
      contentType: compressed.blob.type || "image/webp",
    };
  }
};
