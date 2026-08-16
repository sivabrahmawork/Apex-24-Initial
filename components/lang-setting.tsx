"use client";
// components/lang-setting.tsx — post-login language switch (Profile). Persists to users.locale.
import { useLocale, t } from "../lib/i18n";

export function LangSetting() {
  const [loc, setLoc] = useLocale();
  return (
    <div className="card flex items-center justify-between p-3 text-sm">
      <span className="font-semibold">{t("language", loc)} / भाषा</span>
      <span className="flex gap-1">
        {(["en", "hi"] as const).map(l => (
          <button key={l} onClick={() => setLoc(l)}
            className="rounded-full border px-3 py-0.5 text-xs font-bold"
            style={loc === l ? { background: "var(--accent)", color: "#fff", borderColor: "var(--accent)" }
                             : { borderColor: "var(--line)", color: "var(--ink-soft)" }}>
            {l === "en" ? "English" : "हिन्दी"}
          </button>
        ))}
      </span>
    </div>
  );
}
