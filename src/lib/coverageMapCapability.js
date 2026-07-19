"use client";

const webGlDetails = () => {
  if (typeof document === "undefined") return { available: false, reason: "server" };

  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    if (!gl) return { available: false, reason: "webgl-missing" };

    const maxTextureSize = Number(gl.getParameter(gl.MAX_TEXTURE_SIZE) || 0);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return { available: true, maxTextureSize, reason: null };
  } catch {
    return { available: false, reason: "webgl-error" };
  }
};

export const getCoverageMapCapability = () => {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return { canUse3d: false, reason: "server", reducedQuality: false };
  }

  const webGl = webGlDetails();
  if (!webGl.available) return { canUse3d: false, reason: webGl.reason, reducedQuality: false };

  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const lowMemory = typeof navigator.deviceMemory === "number" && navigator.deviceMemory <= 2;
  const lowConcurrency = typeof navigator.hardwareConcurrency === "number" && navigator.hardwareConcurrency <= 2;
  const smallTextures = webGl.maxTextureSize > 0 && webGl.maxTextureSize < 4096;
  const reducedQuality = Boolean(connection?.saveData || lowMemory || lowConcurrency || smallTextures);

  return {
    canUse3d: true,
    reason: reducedQuality ? "reduced-device" : null,
    reducedQuality,
  };
};
