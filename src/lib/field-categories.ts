export const FIELD_PHOTO_CATEGORIES = [
  { key: "Before", name: "Before", hint: "Site when you arrived", tone: "#2dd4bf" },
  { key: "Damage", name: "Damage", hint: "Problems to document", tone: "#fb7185" },
  { key: "Materials", name: "Materials", hint: "What was delivered", tone: "#fbbf24" },
  { key: "Progress", name: "Progress", hint: "Work underway", tone: "#38bdf8" },
  { key: "Safety", name: "Safety", hint: "Hazards and protection", tone: "#c4b5fd" },
  { key: "After", name: "After", hint: "Finished work", tone: "#86efac" },
] as const;

export type FieldPhotoCategory = (typeof FIELD_PHOTO_CATEGORIES)[number]["key"];

export function isFieldPhotoCategory(value: string): value is FieldPhotoCategory {
  return FIELD_PHOTO_CATEGORIES.some((item) => item.key === value);
}
