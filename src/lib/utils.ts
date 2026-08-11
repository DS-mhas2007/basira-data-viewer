import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind classes intelligently
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format numbers with locale support
 */
export function formatNumber(num: number, locale: "ar" | "en" = "ar"): string {
  return new Intl.NumberFormat(locale === "ar" ? "ar-SA" : "en-US", {
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Format percentage
 */
export function formatPercentage(num: number, decimals: number = 1): string {
  return `${(num * 100).toFixed(decimals)}%`;
}

/**
 * Format file size (bytes → human readable)
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

/**
 * Truncate text with ellipsis
 */
export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + "...";
}

/**
 * Get initials from name (for avatars)
 */
export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Sleep utility for async operations
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if string contains Arabic characters
 */
export function isArabic(str: string): boolean {
  return /[\u0600-\u06FF]/.test(str);
}

/**
 * Get text direction based on content
 */
export function getTextDirection(text: string): "rtl" | "ltr" {
  return isArabic(text) ? "rtl" : "ltr";
}

/**
 * Generate unique ID
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

/**
 * Clamp number between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
