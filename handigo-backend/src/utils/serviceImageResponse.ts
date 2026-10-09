interface ServiceImageFields {
  image?: string | null;
  coverImage?: string | null;
  toObject?: () => ServiceImageFields;
}

// Trả image như bí danh để các client cũ đọc được cover, kể cả query lean.
export const serviceImageResponse = (value: ServiceImageFields | null) => {
  if (!value) return value;
  const data = value.toObject ? value.toObject() : value;
  const coverImage = data.coverImage === undefined ? data.image ?? null : data.coverImage;
  return { ...data, coverImage, image: coverImage };
};
