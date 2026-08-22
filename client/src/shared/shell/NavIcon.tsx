/**
 * أيقونات التنقل الدلالية — نفس مسارات SVG المعتمدة في SIDEBAR-SEMANTIC-ICONS.
 *
 * المسارات ثوابت داخلية بلا أي مدخل مستخدم، لذلك تُحقن كما هي للحفاظ على
 * ترميز مطابق لنسخة V1. الأيقونة `aria-hidden` لأن الزر الحاوي يحمل label نصيًا.
 */
const navIconPaths: Record<string, string> = {
  home: `<path d="M3 10.5 12 3l9 7.5v10H15v-6H9v6H3z"/>`,
  "search-map": `<circle cx="10" cy="10" r="5.5"/><path d="m14 14 6 6M4 3l2 2M18 3l2 2"/>`,
  history: `<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5M12 7v5l3 2"/>`,
  table: `<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 4v16M15 4v16"/>`,
  users: `<circle cx="9" cy="8" r="3"/><path d="M3 20v-1.5a4.5 4.5 0 0 1 4.5-4.5h3A4.5 4.5 0 0 1 15 18.5V20M17 11a3 3 0 1 0-1.5-5.6M21 20v-1.5a4.5 4.5 0 0 0-2.5-4"/>`,
  contact: `<rect x="4" y="3" width="16" height="18" rx="2"/><circle cx="12" cy="9" r="2.5"/><path d="M7.5 17a4.5 4.5 0 0 1 9 0"/>`,
  building: `<path d="M4 21V5l8-3 8 3v16M2 21h20M8 8h1M15 8h1M8 12h1M15 12h1M10 21v-5h4v5"/>`,
  kanban: `<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 4v16M15 4v16M5.5 8h1M10.5 11h2M17.5 8h1"/>`,
  handshake: `<path d="m8 12 3 3a2 2 0 0 0 2.8 0l1.2-1.2M7 7 4 10l4 4M17 7l3 3-4 4M8.5 7 11 5l4 2 1.5 3.5-3 2.5-2.5-2.2L9 12"/>`,
  "check-circle": `<circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/>`,
  calendar: `<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01"/>`,
  inbox: `<path d="M4 4h16v13h-5l-3 3-3-3H4z"/><path d="M4 13h4l1.5 2h5l1.5-2h5"/>`,
  whatsapp: `<path d="M20.5 11.7a8.5 8.5 0 0 1-12.6 7.5l-4.4 1.3 1.3-4.4A8.5 8.5 0 1 1 20.5 11.7Z"/><path d="M8.8 8.1c.2-.5.4-.5.7-.5h.6c.2 0 .4.1.5.4l.8 1.8c.1.3.1.5-.1.7l-.5.6c.6 1.2 1.6 2.1 2.8 2.7l.6-.5c.2-.2.4-.2.7-.1l1.8.8c.3.1.4.3.4.5v.6c0 .3-.2.5-.5.7-.7.3-1.5.3-2.2 0-3.1-1.3-5.5-3.8-6.8-6.8-.3-.7-.3-1.5 0-2.2Z"/>`,
  phone: `<path d="M6 3h3l1.5 4-2 1.5a14 14 0 0 0 7 7l1.5-2 4 1.5v3c0 1.1-.9 2-2 2C10.2 20 4 13.8 4 6a2 2 0 0 1 2-2Z"/>`,
  sparkles: `<path d="m12 3 1.4 4.1L17.5 8.5l-4.1 1.4L12 14l-1.4-4.1-4.1-1.4 4.1-1.4ZM19 15l.7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7ZM5 15l.6 1.8L7.5 18l-1.9.6L5 20.5l-.6-1.9L2.5 18l1.9-.6Z"/>`,
  "message-spark": `<path d="M4 4h16v12H9l-5 4z"/><path d="m15 6 .7 2.1L18 9l-2.3.9L15 12l-.7-2.1L12 9l2.3-.9Z"/>`,
  bot: `<rect x="4" y="7" width="16" height="12" rx="3"/><path d="M12 3v4M8 12h.01M16 12h.01M9 16h6"/>`,
  workflow: `<circle cx="6" cy="5" r="2"/><circle cx="18" cy="12" r="2"/><circle cx="6" cy="19" r="2"/><path d="M8 5h4a4 4 0 0 1 4 4v1M8 19h4a4 4 0 0 0 4-4v-1"/>`,
  "bar-chart": `<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>`,
  plug: `<path d="M8 3v6M12 3v6M6 9h8v2a4 4 0 0 1-4 4v6M18 6l3 3-4 4-3-3z"/>`,
  settings: `<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.8 1.8 0 0 0 .4 2l.1.1-2 2-.1-.1a1.8 1.8 0 0 0-2-.4 1.8 1.8 0 0 0-1.1 1.7v.2h-2.8v-.2A1.8 1.8 0 0 0 10.8 18a1.8 1.8 0 0 0-2 .4l-.1.1-2-2 .1-.1a1.8 1.8 0 0 0 .4-2 1.8 1.8 0 0 0-1.7-1.1h-.2v-2.8h.2A1.8 1.8 0 0 0 7.2 9a1.8 1.8 0 0 0-.4-2l-.1-.1 2-2 .1.1a1.8 1.8 0 0 0 2 .4 1.8 1.8 0 0 0 1.1-1.7v-.2h2.8v.2A1.8 1.8 0 0 0 15.8 5a1.8 1.8 0 0 0 2-.4l.1-.1 2 2-.1.1a1.8 1.8 0 0 0-.4 2 1.8 1.8 0 0 0 1.7 1.1h.2v2.8h-.2a1.8 1.8 0 0 0-1.7 1.1Z"/>`,
};

export function NavIcon({ name }: { name: string }) {
  return (
    <span className={`nav-icon nav-icon--${name}`} aria-hidden="true">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        dangerouslySetInnerHTML={{ __html: navIconPaths[name] ?? navIconPaths.home }}
      />
    </span>
  );
}
