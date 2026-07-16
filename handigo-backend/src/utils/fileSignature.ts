export const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);

const hasBytes = (
  buffer: Buffer,
  signature: number[],
  offset = 0,
) =>
  buffer.length >= offset + signature.length &&
  signature.every((value, index) => buffer[offset + index] === value);

const hasZipSignature = (buffer: Buffer) =>
  hasBytes(buffer, [0x50, 0x4b, 0x03, 0x04]) ||
  hasBytes(buffer, [0x50, 0x4b, 0x05, 0x06]) ||
  hasBytes(buffer, [0x50, 0x4b, 0x07, 0x08]);

export const hasValidFileSignature = (
  buffer: Buffer,
  mimetype: string,
) => {
  switch (mimetype) {
    case "image/jpeg":
    case "image/jpg":
      return hasBytes(buffer, [0xff, 0xd8, 0xff]);
    case "image/png":
      return hasBytes(
        buffer,
        [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
      );
    case "image/webp":
      return (
        buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
        buffer.subarray(8, 12).toString("ascii") === "WEBP"
      );
    case "image/gif":
      return ["GIF87a", "GIF89a"].includes(
        buffer.subarray(0, 6).toString("ascii"),
      );
    case "image/avif":
      return (
        buffer.subarray(4, 8).toString("ascii") === "ftyp" &&
        ["avif", "avis"].includes(buffer.subarray(8, 12).toString("ascii"))
      );
    case "application/pdf":
      return buffer.subarray(0, 5).toString("ascii") === "%PDF-";
    case "application/msword":
      return hasBytes(
        buffer,
        [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1],
      );
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return hasZipSignature(buffer);
    default:
      return false;
  }
};
