export const normalizeImageUrl = (value?: string | null) => {
  const url = value?.trim();
  if (!url) return '';
  if (/^\/\/res\.cloudinary\.com/i.test(url)) return `https:${url}`;
  if (/^res\.cloudinary\.com/i.test(url)) return `https://${url}`;
  return url.replace(/^http:\/\/res\.cloudinary\.com/i, 'https://res.cloudinary.com');
};
