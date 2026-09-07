/**
 * Files attached to a CRM party.
 *
 * Upload is the frozen three-step flow (intent -> content -> attach), and
 * download always issues a FRESH single-use ticket: the ticket is the
 * authorization, so caching a URL would either stop working or, worse, keep
 * working past its lifetime. No storage credential or storage key ever reaches
 * the browser — the API deliberately omits both.
 */
import { useRef, useState } from "react";
import { filesApi, isApiError } from "../../../api";
import { useApiAction } from "../../../api/hooks";
import { useAuth } from "../../../shared/context/AuthProvider";
import { FormError } from "../../../shared/components/ApiStates";
import { useToast } from "../../../shared/store/toast";
import { PartySection } from "./primitives";

interface AttachedFile {
  file_ref: string;
  filename: string;
  content_type: string;
  size_bytes: number;
}

/** ArrayBuffer -> base64, chunked so a large file cannot blow the call stack. */
function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} بايت`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} كيلوبايت`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} ميغابايت`;
}

export function PartyFilesSection({
  subjectType,
  subjectRef,
  files,
  onChanged,
}: {
  subjectType: "lead" | "customer";
  subjectRef: string;
  files: AttachedFile[] | undefined;
  onChanged: () => void;
}) {
  const toast = useToast();
  const { can } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busyRef, setBusyRef] = useState("");

  const upload = useApiAction(async (file: File) => {
    const asset = await filesApi.createIntent({
      filename: file.name,
      content_type: file.type || "application/octet-stream",
      size_bytes: file.size,
    });
    await filesApi.uploadContent(asset.id, toBase64(await file.arrayBuffer()));
    await filesApi.attach(asset.id, subjectType, subjectRef);
    return asset;
  });

  const download = async (fileRef: string, filename: string) => {
    setBusyRef(fileRef);
    try {
      const blob = await filesApi.download(fileRef);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (cause) {
      // An expired or already-redeemed ticket is a normal outcome, not a bug:
      // say so, and let the user ask for a new one by clicking again.
      if (isApiError(cause) && (cause.kind === "conflict" || cause.kind === "not_found")) {
        toast("انتهت صلاحية رابط التنزيل. حاول مرة أخرى.", "info");
      } else {
        toast("تعذر تنزيل الملف.", "error");
      }
    } finally {
      setBusyRef("");
    }
  };

  return (
    <PartySection
      title="الملفات"
      present={files !== undefined}
      isEmpty={(files ?? []).length === 0}
      emptyText="لا توجد ملفات مرفقة."
      action={
        can("file.upload") ? (
          <>
            <button
              className="button ghost compact"
              type="button"
              disabled={upload.pending}
              onClick={() => inputRef.current?.click()}
            >
              {upload.pending ? "جارٍ الرفع…" : "رفع ملف"}
            </button>
            <input
              ref={inputRef}
              type="file"
              hidden
              onChange={async (event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                const result = await upload.run(file);
                if (!result) return;
                toast("تم رفع الملف وإرفاقه.", "success");
                onChanged();
              }}
            />
          </>
        ) : null
      }
    >
      <FormError error={upload.error} />
      {(files ?? []).map((file) => (
        <div className="party-row" key={file.file_ref}>
          <span className="grow">
            <b>{file.filename}</b>
            <small>{formatSize(file.size_bytes)}</small>
          </span>
          {can("file.download") ? (
            <button
              className="button ghost compact"
              type="button"
              disabled={busyRef === file.file_ref}
              onClick={() => download(file.file_ref, file.filename)}
            >
              {busyRef === file.file_ref ? "…" : "تنزيل"}
            </button>
          ) : null}
        </div>
      ))}
    </PartySection>
  );
}
