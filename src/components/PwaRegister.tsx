"use client";

import { useEffect } from "react";

export default function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      console.warn(
        "Service workers are not supported."
      );
      return;
    }

    const registerServiceWorker =
      async () => {
        try {
          const registration =
            await navigator.serviceWorker.register(
              "/sw.js",
              {
                scope: "/",
              }
            );

          console.log(
            "[Freshers Gate] Service worker registered:",
            registration.scope
          );

          await registration.update();

          if (registration.waiting) {
            registration.waiting.postMessage({
              type: "SKIP_WAITING",
            });
          }
        } catch (error) {
          console.error(
            "[Freshers Gate] Service worker registration failed:",
            error
          );
        }
      };

    void registerServiceWorker();
  }, []);

  return null;
}