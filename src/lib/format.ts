export function formatAddress(parts: {
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
  country?: string | null;
}) {
  return [
    parts.addressLine1,
    parts.addressLine2,
    [parts.city, parts.region, parts.postalCode].filter(Boolean).join(", "),
    parts.country,
  ]
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(" · ");
}

export function formatMoney(cents: number, currency = "usd") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
}

export function mapsUrl(input: {
  latitude?: number | null;
  longitude?: number | null;
  address?: string;
}) {
  if (input.latitude != null && input.longitude != null) {
    return `https://www.openstreetmap.org/?mlat=${input.latitude}&mlon=${input.longitude}#map=16/${input.latitude}/${input.longitude}`;
  }
  if (input.address) {
    return `https://www.openstreetmap.org/search?query=${encodeURIComponent(input.address)}`;
  }
  return null;
}

export function directionsUrl(input: {
  latitude?: number | null;
  longitude?: number | null;
  address?: string;
}) {
  const destination =
    input.latitude != null && input.longitude != null
      ? `${input.latitude},${input.longitude}`
      : input.address;
  if (!destination) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

export function toDateInput(value: Date | string | null | undefined) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}
