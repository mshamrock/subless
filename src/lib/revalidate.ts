import { revalidatePath as nextRevalidatePath, revalidateTag } from "next/cache";
import { PUBLIC_TAG } from "./public-cache";

/** revalidatePath that also drops the cached public data, so every write is visible at once */
export function revalidatePath(...args: Parameters<typeof nextRevalidatePath>) {
  revalidateTag(PUBLIC_TAG);
  return nextRevalidatePath(...args);
}

export { PUBLIC_TAG };
