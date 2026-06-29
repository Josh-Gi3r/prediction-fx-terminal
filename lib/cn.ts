import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Compose Tailwind classes with conflict resolution.
 * Use anywhere you'd normally template-string classes together.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
