export type AnalyticsConsent = "unknown" | "granted" | "denied";

const STORAGE_KEY = "mizya:analytics-consent:v1";
export const ANALYTICS_CONSENT_EVENT = "mizya:analytics-consent-change";

/** Read the saved choice; unavailable storage is treated as no choice, never as consent. */
export function getAnalyticsConsent(): AnalyticsConsent {
  if (typeof window === "undefined") return "unknown";
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === "granted" || value === "denied" ? value : "unknown";
  } catch {
    return "unknown";
  }
}

/** Persist the user's explicit choice when possible and notify mounted controls in this tab. */
export function setAnalyticsConsent(value: Exclude<AnalyticsConsent, "unknown">): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Consent still applies for the current mounted session; storage failure never enables it by default.
  }
  window.dispatchEvent(
    new CustomEvent<AnalyticsConsent>(ANALYTICS_CONSENT_EVENT, { detail: value }),
  );
}

/** DNT and Global Privacy Control take precedence over a previously saved opt-in. */
export function hasAnalyticsOptOutSignal(): boolean {
  if (typeof navigator === "undefined") return false;
  const extended = navigator as Navigator & {
    globalPrivacyControl?: boolean | number;
    msDoNotTrack?: string;
  };
  const dnt = navigator.doNotTrack?.toLowerCase();
  return (
    dnt === "1" ||
    dnt === "yes" ||
    extended.msDoNotTrack === "1" ||
    extended.globalPrivacyControl === true ||
    extended.globalPrivacyControl === 1
  );
}
