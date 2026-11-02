import { useSyncExternalStore } from "react";
import { useSiteAccount } from "../components/AccountGate";
type DeviceProfile = { name: string; avatar: string };
const EMPTY: DeviceProfile = { name: "", avatar: "" };
let previousKey = "",
  previousRaw: string | null = null,
  previousValue = EMPTY;
const subscribe = (listener: () => void) => {
  window.addEventListener("xerox-profile-updated", listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener("xerox-profile-updated", listener);
    window.removeEventListener("storage", listener);
  };
};
export function useDeviceProfile() {
  const account = useSiteAccount();
  const key = `xerox_device_profile_${account?.username || "guest"}`;
  const profile = useSyncExternalStore(
    subscribe,
    () => {
      let raw: string | null = null;
      try {
        raw = localStorage.getItem(key);
      } catch {}
      if (previousKey === key && previousRaw === raw) return previousValue;
      previousKey = key;
      previousRaw = raw;
      try {
        const data = JSON.parse(raw || "{}");
        previousValue = {
          name: typeof data.name === "string" ? data.name.slice(0, 40) : "",
          avatar:
            typeof data.avatar === "string" &&
            /^data:image\/(png|jpeg|webp);base64,/.test(data.avatar)
              ? data.avatar
              : "",
        };
      } catch {
        previousValue = EMPTY;
      }
      return previousValue;
    },
    () => EMPTY,
  );
  return {
    name: profile.name || account?.username || "マイページ",
    avatar: profile.avatar,
    username: account?.username || "",
    save: (value: DeviceProfile) => {
      localStorage.setItem(
        key,
        JSON.stringify({
          name: value.name.trim().slice(0, 40),
          avatar: value.avatar,
        }),
      );
      window.dispatchEvent(new Event("xerox-profile-updated"));
    },
  };
}
export async function readProfileImage(file: File): Promise<string> {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 5 * 1024 * 1024
  )
    throw new Error("5MB以下のPNG・JPEG・WebPを選んでください。");
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("画像を読み込めませんでした。");
  }
  const edge = Math.min(bitmap.width, bitmap.height);
  ctx.drawImage(
    bitmap,
    (bitmap.width - edge) / 2,
    (bitmap.height - edge) / 2,
    edge,
    edge,
    0,
    0,
    256,
    256,
  );
  bitmap.close();
  return canvas.toDataURL("image/webp", 0.85);
}
