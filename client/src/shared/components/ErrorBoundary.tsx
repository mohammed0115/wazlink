/**
 * حاجز أخطاء العرض.
 *
 * يمنع خطأ في شاشة واحدة من إسقاط التطبيق كله، ويعرض حالة قابلة للتعافي
 * بنظام تصميم «نمو» نفسه. لا يرسل أي تقرير خارجي — الجلسة محلية بالكامل.
 */
import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // سجل محلي فقط؛ لا إرسال إلى خدمة مراقبة خارجية.
    console.error("خطأ عرض غير متوقع:", error, info.componentStack);
  }

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <section className="placeholder-card" role="alert">
        <span className="status danger">خطأ عرض</span>
        <div>
          <h2>تعذر عرض هذه الشاشة</h2>
          <p>
            حدث خطأ غير متوقع في طبقة العرض. البيانات التشغيلية لم تتغير، ويمكنك العودة إلى الرئيسية أو إعادة المحاولة.
          </p>
          <small className="mono ltr">{error.message}</small>
        </div>
        <button className="button primary" type="button" onClick={() => this.setState({ error: null })}>
          إعادة المحاولة
        </button>
      </section>
    );
  }
}
