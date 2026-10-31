import { useEffect, useRef, useState } from "react";
import { ImageOff } from "lucide-react";

/**
 * Imagen privada: solo se pide cuando aparece en pantalla (cuida los datos
 * móviles), llega como Blob con el token en la cabecera (sin caché) y se libera
 * al salir. Nunca hay una URL del almacenamiento ni un token en la página.
 */
export function PrivateImage({ load, alt, unavailableLabel, className = "", testId, onUnavailable, fit = "cover" }: {
  /** Pide los bytes (p. ej. getActivityPhotoImage); se llama una vez por montaje. */
  load: () => Promise<Blob>;
  alt: string;
  unavailableLabel: string;
  className?: string;
  testId?: string;
  /** La imagen ya no se puede ver (retirada, consentimiento revocado, sin acceso). */
  onUnavailable?: () => void;
  /** cover: miniatura recortada; contain: imagen completa (visor). */
  fit?: "cover" | "contain";
}) {
  const box = useRef<HTMLDivElement>(null);
  // Sin IntersectionObserver (navegadores antiguos) se carga en seguida.
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === "undefined");
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const loadRef = useRef(load);
  useEffect(() => { loadRef.current = load; }, [load]);
  const unavailableRef = useRef(onUnavailable);
  useEffect(() => { unavailableRef.current = onUnavailable; }, [onUnavailable]);

  useEffect(() => {
    const node = box.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) { setVisible(true); observer.disconnect(); }
    }, { rootMargin: "200px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    let objectUrl: string | null = null;
    let cancelled = false;
    loadRef.current()
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => { if (!cancelled) { setFailed(true); unavailableRef.current?.(); } });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [visible]);

  return (
    <div ref={box} className={`flex items-center justify-center overflow-hidden bg-[var(--color-ivory-100)] ${className}`} data-testid={testId}>
      {url
        ? <img src={url} alt={alt} className={`h-full w-full ${fit === "contain" ? "object-contain" : "object-cover"}`} data-loaded="true" draggable={false} />
        : failed
          ? <ImageOff size={22} aria-label={unavailableLabel} className="text-[var(--color-text-muted)]" />
          : <span className="h-full w-full animate-pulse bg-[var(--color-ivory-200)]" aria-hidden />}
    </div>
  );
}
