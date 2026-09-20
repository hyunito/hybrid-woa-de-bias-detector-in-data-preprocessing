/**
 * Storage helpers for managing session prerequisites across the audit workflow.
 */

export function getStoredItem<T>(key: string, fallback: T): T {
  try {
    const item = sessionStorage.getItem(key);
    if (!item || item === "undefined") {
      return fallback;
    }
    return JSON.parse(item) as T;
  } catch {
    return fallback;
  }
}

export function hasUploadedDataset(): boolean {
  const dataset = sessionStorage.getItem("scanned_dataset");
  return Boolean(dataset && dataset !== "undefined");
}

export function hasConfiguredScripts(): boolean {
  const rawScripts = sessionStorage.getItem("pipeline_scripts");
  if (!rawScripts || rawScripts === "undefined") {
    return false;
  }
  try {
    const parsed = JSON.parse(rawScripts);
    return Array.isArray(parsed) && parsed.length > 0;
  } catch {
    return false;
  }
}

export function hasConfiguredAudit(): boolean {
  const config = sessionStorage.getItem("audit_config");
  return Boolean(config && config !== "undefined");
}

export function hasPrerequisitesForConfiguration(): boolean {
  return hasUploadedDataset() && hasConfiguredScripts();
}

export function hasPrerequisitesForProcessing(): boolean {
  return hasUploadedDataset() && hasConfiguredScripts() && hasConfiguredAudit();
}
