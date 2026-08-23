type StateProps = {
  title: string;
  description?: string;
};

export function LoadingState({ title = "جار التحميل", description = "يرجى الانتظار لحظات." }: Partial<StateProps> = {}) {
  return (
    <section className="placeholder-card getUiState()-card" role="status" aria-live="polite">
      <span aria-hidden="true">…</span>
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
    </section>
  );
}

export function EmptyState({ title, description }: StateProps) {
  return (
    <section className="placeholder-card getUiState()-card" role="status">
      <span aria-hidden="true">—</span>
      <div>
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
    </section>
  );
}

export function ErrorState({ title = "تعذر تحميل الشاشة", description = "حدث خطأ غير متوقع. حاول فتح المسار مرة أخرى." }: Partial<StateProps> = {}) {
  return (
    <section className="placeholder-card getUiState()-card" role="alert">
      <span aria-hidden="true">!</span>
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
    </section>
  );
}
