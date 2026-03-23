"use client";

import { useState, useEffect } from "react";

interface ImageDimensions {
  width: number;
  height: number;
}

export function useImageDimensions(file: File | null): ImageDimensions | null {
  const [dims, setDims] = useState<ImageDimensions | null>(null);

  useEffect(() => {
    if (!file) {
      setDims(null);
      return;
    }

    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setDims({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      setDims(null);
      URL.revokeObjectURL(url);
    };
    img.src = url;

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  return dims;
}
