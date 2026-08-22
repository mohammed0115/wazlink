/**
 * سلوك إغلاق النوافذ — وصول لوحة المفاتيح.
 *
 * كل نافذة تُغلق بمفتاح Escape وتعيد التركيز إلى العنصر الذي فتحها،
 * وفق قاعدة `DESIGN_SYSTEM.md`: «Modal/Drawer يملك keyboard access
 * وclose action وfocus behavior».
 */
import { useEffect, useRef } from "react";

export function useModalDismiss(onClose: () => void) {
  const panel = useRef<HTMLElement | null>(null);
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    opener.current = document.activeElement;
    panel.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      const previous = opener.current as HTMLElement | null;
      if (previous?.focus) previous.focus();
    };
  }, [onClose]);

  return panel;
}
