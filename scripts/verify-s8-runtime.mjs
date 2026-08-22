/**
 * S8 runtime smoke — يرسم Inbox عبر حدود مكوّن React الحقيقي.
 *
 * لا متصفح ولا شبكة ولا قناة خارجية. الغرض إثبات أن Copilot **يُدرج مسودة
 * فقط**، وأن الإرسال البشري وحده ينشئ رسالة واحدة بـ`senderType = user`.
 */
import assert from "node:assert/strict";
import { createServer } from "vite";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";

const passes = [];
const check = (label, condition) => {
  assert.equal(Boolean(condition), true, label);
  passes.push(label);
};

const server = await createServer({
  configFile: false,
  root: new URL("../client", import.meta.url).pathname,
  logLevel: "error",
  resolve: {
    alias: {
      "@": new URL("../client/src", import.meta.url).pathname,
      "@domain": new URL("../client/src/domain", import.meta.url).pathname,
      "@services": new URL("../client/src/services", import.meta.url).pathname,
    },
  },
  plugins: [(await import("@vitejs/plugin-react")).default()],
});

try {
  const [{ Inbox }, data, salesAi] = await Promise.all([
    server.ssrLoadModule("/src/features/inbox/Inbox.tsx"),
    server.ssrLoadModule("/src/domain/data.js"),
    server.ssrLoadModule("/src/domain/sales-ai.js"),
  ]);
  const { getConversationMessages, sendMockMessage, state } = data;
  const { runCopilotAnalysis, useSuggestedReply } = salesAi;

  state.selectedConversationId = "CONV-3042";
  state.inboxContextOpen = true;
  state.inboxDrafts = {};
  state.inboxAssistance = null;

  const inboxMarkup = renderToStaticMarkup(createElement(Inbox));
  check("Fresh Inbox render completes", inboxMarkup.includes("s7-inbox-layout"));
  check("Conversation list renders", inboxMarkup.includes("s7-conversation-list"));
  check("Copilot panel renders in context", inboxMarkup.includes("s8-copilot"));

  const conversationMarkup = renderToStaticMarkup(createElement(Inbox, { conversationId: "CONV-3042" }));
  check("Direct conversation route renders", conversationMarkup.includes("CONV-3042"));
  check("Composer renders", conversationMarkup.includes("messageComposer") && conversationMarkup.includes("إرسال بشري"));
  check("Mock channel disclosure is visible", conversationMarkup.includes("واتساب — وضع تجريبي"));

  const messagesBeforeInsert = getConversationMessages("CONV-3042").length;
  const analysis = runCopilotAnalysis("LEAD-1042", "CONV-3042");
  const reply = analysis.records.find((record) => record.outputType === "suggested_reply");
  check("Copilot produces a suggested reply", Boolean(reply));

  const inserted = useSuggestedReply(reply.id);
  check("Use suggested reply inserts a draft", inserted && state.inboxDrafts["CONV-3042"] === reply.payload.text);
  check("Insert-only does not create a message", getConversationMessages("CONV-3042").length === messagesBeforeInsert);

  const sent = sendMockMessage("CONV-3042", state.inboxDrafts["CONV-3042"], { assistance: state.inboxAssistance });
  check("Human send creates one outbound message", sent?.direction === "outbound" && sent?.senderType === "user");
  check("Human send increases count once", getConversationMessages("CONV-3042").length === messagesBeforeInsert + 1);
} finally {
  await server.close();
}

console.log(`S8 runtime smoke: ${passes.length}/${passes.length} PASS`);
passes.forEach((item, index) => console.log(`PASS ${index + 1} — ${item}`));
