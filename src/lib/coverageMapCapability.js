"use client";

export const coverageMapModes = {
  auto: "auto",
  flat: "2d",
  globe: "3d",
};

export const coverageMapModeStorageKey = "chessview_coverage_map_mode";
export const coverageMap3dDisabledStorageKey = "chessview_coverage_3d_disabled_until";
export const coverageMapFallbackTtlMs = 7 * 24 * 60 * 60 * 1000;

const validModes = new Set(Object.values(coverageMapModes));

const storage = () => {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
};

export const readCoverageMapModePreference = () => {
  const value = storage()?.getItem(coverageMapModeStorageKey);
  return validModes.has(value) ? value : coverageMapModes.auto;
};

export const writeCoverageMapModePreference = (mode) => {
  if (!validModes.has(mode)) return;
  try {
    storage()?.setItem(coverageMapModeStorageKey, mode);
  } catch {
    // Local storage can be blocked in private or restricted contexts.
  }
};

export const clearCoverageMap3dFallback = () => {
  try {
    storage()?.removeItem(coverageMap3dDisabledStorageKey);
  } catch {
    // Local storage can be blocked in private or restricted contexts.
  }
};

export const readCoverageMap3dFallback = (now = Date.now()) => {
  try {
    const value = storage()?.getItem(coverageMap3dDisabledStorageKey);
    if (!value) return null;

    const parsed = JSON.parse(value);
    if (Number(parsed?.disabledUntil) > now) {
      return {
        disabledUntil: Number(parsed.disabledUntil),
        reason: parsed.reason || "low-fps",
      };
    }

    clearCoverageMap3dFallback();
    return null;
  } catch {
    clearCoverageMap3dFallback();
    return null;
  }
};

export const rememberCoverageMap3dFallback = (reason, now = Date.now()) => {
  try {
    storage()?.setItem(
      coverageMap3dDisabledStorageKey,
      JSON.stringify({
        disabledUntil: now + coverageMapFallbackTtlMs,
        reason,
      }),
    );
  } catch {
    // Local storage can be blocked in private or restricted contexts.
  }
};

const webGlDetails = () => {
  if (typeof document === "undefined") return { available: false, reason: "webgl-missing" };

  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    if (!gl) return { available: false, reason: "webgl-missing" };

    const maxTextureSize = Number(gl.getParameter(gl.MAX_TEXTURE_SIZE) || 0);
    gl.getExtension("WEBGL_lose_context")?.loseContext();

    return {
      available: true,
      maxTextureSize,
      reason: null,
    };
  } catch {
    return { available: false, reason: "webgl-error" };
  }
};

export const getCoverageMapCapability = () => {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return { canUse3d: false, reason: "server" };
  }

  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (connection?.saveData) return { canUse3d: false, reason: "save-data" };

  if (typeof navigator.deviceMemory === "number" && navigator.deviceMemory <= 2) {
    return { canUse3d: false, reason: "weak-device" };
  }

  if (typeof navigator.hardwareConcurrency === "number" && navigator.hardwareConcurrency <= 2) {
    return { canUse3d: false, reason: "weak-device" };
  }

  const webGl = webGlDetails();
  if (!webGl.available) return { canUse3d: false, reason: webGl.reason };

  if (webGl.maxTextureSize && webGl.maxTextureSize < 4096) {
    return { canUse3d: false, reason: "weak-device" };
  }

  return {
    canUse3d: true,
    reason: null,
  };
};

export const isHardCoverageMap3dBlock = (reason) => reason === "server" || reason === "webgl-error" || reason === "webgl-missing";
