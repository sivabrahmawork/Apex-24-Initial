"use client";
// lib/i18n.ts — pilot i18n: UI chrome in en/hi. Content stays source-language; comments translate on demand.
import { useEffect, useState } from "react";

export type Locale = "en" | "hi";
const DICT: Record<Locale, Record<string, string>> = {
  en: {
    home: "Home", chat: "Chat", feedback: "Feedback", profile: "Profile",
    discuss: "comments → join the discussion", post: "Post", reply: "Reply", share: "Share",
    translate: "Translate", original: "Original", writeArticle: "✍ Write an article",
    addComment: "Add to the discussion — Apex will tag it as question, analysis, pro, con, assumption or solution.",
    signin: "Sign in to Apex", sendCode: "Send code", verify: "Verify", language: "Language",
    poll: "Poll", vote: "Vote", askQuestion: "Poll question…", option: "Option",
  },
  hi: {
    home: "होम", chat: "चैट", feedback: "प्रतिक्रिया", profile: "प्रोफ़ाइल",
    discuss: "टिप्पणियाँ → चर्चा में शामिल हों", post: "पोस्ट", reply: "जवाब", share: "साझा करें",
    translate: "अनुवाद", original: "मूल", writeArticle: "✍ लेख लिखें",
    addComment: "चर्चा में जोड़ें — Apex इसे प्रश्न, विश्लेषण, पक्ष, विपक्ष, धारणा या समाधान के रूप में टैग करेगा।",
    signin: "Apex में साइन इन करें", sendCode: "कोड भेजें", verify: "सत्यापित करें", language: "भाषा",
    poll: "पोल", vote: "वोट", askQuestion: "पोल का प्रश्न…", option: "विकल्प",
  },
};

export function getLocale(): Locale {
  if (typeof window === "undefined") return "en";
  return (localStorage.getItem("locale") as Locale) || "en";
}
export function setLocale(l: Locale) {
  localStorage.setItem("locale", l);
  window.dispatchEvent(new Event("locale-change"));
  fetch("/api/me/locale", { method: "PATCH", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ locale: l }) }).catch(() => {});
}
export function useLocale(): [Locale, (l: Locale) => void] {
  const [loc, set] = useState<Locale>("en");
  useEffect(() => {
    set(getLocale());
    const h = () => set(getLocale());
    window.addEventListener("locale-change", h);
    return () => window.removeEventListener("locale-change", h);
  }, []);
  return [loc, (l) => { setLocale(l); set(l); }];
}
export function t(key: string, loc?: Locale): string {
  return DICT[loc ?? getLocale()]?.[key] ?? DICT.en[key] ?? key;
}
