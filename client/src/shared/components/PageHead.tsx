/** ترويسة الصفحة المشتركة — مقابل `pageHead()` في نسخة V1. */
import type { ReactNode } from "react";

export function PageHead({
  kicker,
  title,
  description,
  actions,
}: {
  kicker: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="page-head">
      <div>
        <p className="eyebrow">{kicker}</p>
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      <div className="page-head-actions">{actions}</div>
    </header>
  );
}
