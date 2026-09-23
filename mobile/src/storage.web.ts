export async function getItem(key: string) {
  return localStorage.getItem(key);
}

export async function setItem(key: string, value: string) {
  localStorage.setItem(key, value);
}

export async function deleteItem(key: string) {
  localStorage.removeItem(key);
}
