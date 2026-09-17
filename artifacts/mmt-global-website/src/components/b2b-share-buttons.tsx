import { useState } from "react";
import { Check, Copy, Linkedin, Send, Share2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";

type B2BShareButtonsProps = {
  title: string;
  url: string;
};

export function B2BShareButtons({ title, url }: B2BShareButtonsProps) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const encodedUrl = encodeURIComponent(url);
  const encodedText = encodeURIComponent(`${title} | MMT Global`);
  const canUseNativeShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  async function copyLink() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function nativeShare() {
    await navigator.share({ title, text: t("share_listing"), url });
  }

  return (
    <div className="mt-8 border-t border-border/70 pt-6">
      <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
        <Share2 size={13} />
        {t("share_listing")}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {canUseNativeShare ? (
          <button
            type="button"
            onClick={nativeShare}
            className="inline-flex items-center gap-2 border border-primary bg-primary px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary/90"
          >
            <Share2 size={13} />
            {t("native_share")}
          </button>
        ) : null}
        <a
          href={`https://wa.me/?text=${encodedText}%20${encodedUrl}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 border border-border/70 px-3 py-2 text-xs font-semibold transition-colors hover:border-primary hover:text-primary"
        >
          {t("whatsapp")}
        </a>
        <a
          href={`https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 border border-border/70 px-3 py-2 text-xs font-semibold transition-colors hover:border-primary hover:text-primary"
        >
          <Send size={13} />
          {t("telegram")}
        </a>
        <a
          href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 border border-border/70 px-3 py-2 text-xs font-semibold transition-colors hover:border-primary hover:text-primary"
        >
          <Linkedin size={13} />
          {t("linkedin")}
        </a>
        <button
          type="button"
          onClick={copyLink}
          className="inline-flex items-center gap-2 border border-border/70 px-3 py-2 text-xs font-semibold transition-colors hover:border-primary hover:text-primary"
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? t("copied") : t("copy_link")}
        </button>
      </div>
    </div>
  );
}