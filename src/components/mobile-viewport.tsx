"use client";

import { useEffect } from "react";
import { trackMobileViewport } from "@/lib/mobile-viewport";

export function MobileViewport() {
  useEffect(() => trackMobileViewport(), []);
  return null;
}
