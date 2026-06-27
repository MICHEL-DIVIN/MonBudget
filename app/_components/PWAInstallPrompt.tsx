"use client";

import { useState, useEffect } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Détecter iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    // Écouter l'événement beforeinstallprompt (Android/Chrome)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      
      // Afficher le prompt après un délai
      setTimeout(() => {
        setShowPrompt(true);
      }, 3000);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Vérifier si déjà installé
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setShowPrompt(false);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === "accepted") {
      setShowPrompt(false);
    }
    
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem("pwa-install-dismissed", Date.now().toString());
  };

  // Ne pas afficher si déjà rejeté récemment (7 jours)
  useEffect(() => {
    const dismissed = localStorage.getItem("pwa-install-dismissed");
    if (dismissed) {
      const daysSinceDismiss = (Date.now() - parseInt(dismissed)) / (1000 * 60 * 60 * 24);
      if (daysSinceDismiss < 7) {
        setShowPrompt(false);
      }
    }
  }, []);

  if (!showPrompt) return null;

  // Pour iOS, afficher des instructions différentes
  if (isIOS) {
    return (
      <div
        style={{
          position: "fixed",
          bottom: 20,
          left: 20,
          right: 20,
          zIndex: 1000,
          maxWidth: 400,
          margin: "0 auto",
        }}
      >
        <div
          style={{
            background: "#1a1a24",
            borderRadius: 16,
            padding: 16,
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            border: "1px solid #2a2a36",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: "rgba(139,92,246,0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 24, color: "#8b5cf6" }}>
                download
              </span>
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: "#f0f0f4", margin: "0 0 6px 0" }}>
                Installer MonBudget
              </h3>
              <p style={{ fontSize: 13, color: "#6b6b80", margin: "0 0 12px 0", lineHeight: 1.4 }}>
                Appuyez sur le bouton Partager <span style={{ fontSize: 16 }}>⎋</span> puis "Sur l'écran d'accueil"
              </p>
              <button
                onClick={handleDismiss}
                style={{
                  background: "transparent",
                  border: "1px solid #2a2a36",
                  color: "#6b6b80",
                  padding: "8px 16px",
                  borderRadius: 8,
                  fontSize: 13,
                  cursor: "pointer",
                  width: "100%",
                }}
              >
                Compris
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Pour Android/Chrome
  return (
    <div
      style={{
        position: "fixed",
        bottom: 20,
        left: 20,
        right: 20,
        zIndex: 1000,
        maxWidth: 400,
        margin: "0 auto",
      }}
    >
      <div
        style={{
          background: "#1a1a24",
          borderRadius: 16,
          padding: 16,
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          border: "1px solid #2a2a36",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: "rgba(139,92,246,0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 24, color: "#8b5cf6" }}>
              download
            </span>
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: "#f0f0f4", margin: "0 0 6px 0" }}>
              Installer l'application
            </h3>
            <p style={{ fontSize: 13, color: "#6b6b80", margin: "0 0 12px 0", lineHeight: 1.4 }}>
              Installez MonBudget sur votre appareil pour un accès rapide et une expérience optimale.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={handleInstallClick}
                style={{
                  background: "#8b5cf6",
                  border: "none",
                  color: "#fff",
                  padding: "8px 16px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                  flex: 1,
                }}
              >
                Installer maintenant
              </button>
              <button
                onClick={handleDismiss}
                style={{
                  background: "transparent",
                  border: "1px solid #2a2a36",
                  color: "#6b6b80",
                  padding: "8px 16px",
                  borderRadius: 8,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Plus tard
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
