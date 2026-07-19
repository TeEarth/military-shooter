"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { sfx } from "@/lib/sfx";
import { HOW_TO_PLAY_CATEGORIES, HOW_TO_PLAY_SECTIONS, type HowToPlaySection } from "@/lib/howToPlayContent";
import Icon from "@/components/ui/Icon";

/** v62: renders the section's Icon Manager glyph when set (preferred — same
 *  vivid icons used everywhere else in the game), falling back to the plain
 *  sprite-file badge otherwise. */
function SectionIcon({ section, size }: { section: HowToPlaySection; size: number }) {
  if (section.iconName) return <Icon name={section.iconName} size={size} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={section.icon} alt="" className="object-contain flex-shrink-0" style={{ width: size, height: size }} />;
}

const LAST_SECTION_KEY = "how_to_play_last_section";

export default function HowToPlayClient() {
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<string>(HOW_TO_PLAY_SECTIONS[0].id);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const didRestoreScroll = useRef(false);

  const filteredIds = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null; // null = no filter, show everything
    return new Set(
      HOW_TO_PLAY_SECTIONS.filter(
        (s) => s.title.toLowerCase().includes(q) || s.label.toLowerCase().includes(q) || s.body.some((line) => line.toLowerCase().includes(q))
      ).map((s) => s.id)
    );
  }, [query]);

  const visibleSections = filteredIds ? HOW_TO_PLAY_SECTIONS.filter((s) => filteredIds.has(s.id)) : HOW_TO_PLAY_SECTIONS;

  // Restore the last-read section on first load (once, before the observer takes over).
  useEffect(() => {
    if (didRestoreScroll.current) return;
    didRestoreScroll.current = true;
    const lastId = localStorage.getItem(LAST_SECTION_KEY);
    if (!lastId) return;
    const el = sectionRefs.current[lastId];
    if (el) {
      el.scrollIntoView({ block: "start" });
      setActiveId(lastId);
    }
  }, []);

  // Track which section is currently in view — updates the TOC highlight and
  // remembers it for next time the page is opened.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          const id = visible[0].target.id;
          setActiveId(id);
          localStorage.setItem(LAST_SECTION_KEY, id);
        }
      },
      { rootMargin: "-10% 0px -70% 0px", threshold: 0 }
    );
    Object.values(sectionRefs.current).forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [visibleSections.length]);

  function jumpTo(id: string) {
    sfx.play("ui_click");
    sectionRefs.current[id]?.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  const activeIndex = HOW_TO_PLAY_SECTIONS.findIndex((s) => s.id === activeId);
  const prevSection = activeIndex > 0 ? HOW_TO_PLAY_SECTIONS[activeIndex - 1] : null;
  const nextSection = activeIndex >= 0 && activeIndex < HOW_TO_PLAY_SECTIONS.length - 1 ? HOW_TO_PLAY_SECTIONS[activeIndex + 1] : null;

  return (
    <div className="min-h-screen page-bg-themed">
      <div className="bg-military-dark/80 backdrop-blur-sm border-b border-military-steel px-4 py-3 flex items-center gap-4 sticky top-0 z-20">
        <Link href="/home" className="text-military-steel hover:text-white text-sm" onClick={() => sfx.play("ui_click")}>← BACK</Link>
        <h1 className="text-xl font-black text-military-tan uppercase tracking-widest">How to Play</h1>
      </div>

      <div className="flex max-w-6xl mx-auto">
        {/* TOC sidebar — sticky on desktop, becomes a horizontal scroller on mobile via overflow. */}
        <aside className="w-64 flex-shrink-0 hidden md:block">
          <div className="sticky top-[57px] max-h-[calc(100vh-57px)] overflow-y-auto p-4 space-y-4">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search topics..."
              className="w-full bg-military-darker border border-military-steel px-3 py-2 text-sm text-white placeholder-military-steel focus:outline-none focus:border-military-tan"
            />
            {HOW_TO_PLAY_CATEGORIES.map((category) => {
              const items = visibleSections.filter((s) => s.category === category);
              if (items.length === 0) return null;
              return (
                <div key={category}>
                  <h2 className="text-military-gold text-xs font-bold uppercase tracking-wider mb-1.5">{category}</h2>
                  <div className="space-y-0.5">
                    {items.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => jumpTo(s.id)}
                        className={`w-full text-left px-2 py-1.5 text-xs rounded flex items-center gap-2 transition-colors ${
                          activeId === s.id ? "bg-military-dark text-military-tan font-bold" : "text-military-steel hover:text-white hover:bg-military-dark/50"
                        }`}
                      >
                        <SectionIcon section={s} size={16} />
                        <span className="truncate">{s.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        {/* Mobile TOC: a simple search + jump dropdown, since a full sidebar doesn't fit. */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-20 bg-military-dark/95 backdrop-blur-sm border-t border-military-steel p-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search topics..."
            className="w-full bg-military-darker border border-military-steel px-3 py-2 text-sm text-white placeholder-military-steel focus:outline-none focus:border-military-tan mb-2"
          />
          <select
            value={activeId}
            onChange={(e) => jumpTo(e.target.value)}
            className="w-full bg-military-darker border border-military-steel px-3 py-2 text-sm text-white"
          >
            {visibleSections.map((s) => (
              <option key={s.id} value={s.id}>{s.category} — {s.label}</option>
            ))}
          </select>
        </div>

        {/* Content */}
        <main className="flex-1 min-w-0 p-4 md:p-6 pb-32 md:pb-10 space-y-10">
          {visibleSections.length === 0 && (
            <p className="text-military-steel text-sm">No topics match &quot;{query}&quot;.</p>
          )}
          {visibleSections.map((section) => (
            <SectionCard
              key={section.id}
              section={section}
              refCallback={(el) => { sectionRefs.current[section.id] = el; }}
            />
          ))}

          {visibleSections.length > 0 && (
            <div className="flex items-center justify-between pt-4 border-t border-military-steel/30">
              {prevSection ? (
                <button onClick={() => jumpTo(prevSection.id)} className="btn-military text-xs">← {prevSection.label}</button>
              ) : <span />}
              {nextSection ? (
                <button onClick={() => jumpTo(nextSection.id)} className="btn-military text-xs">{nextSection.label} →</button>
              ) : <span />}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function SectionCard({ section, refCallback }: { section: HowToPlaySection; refCallback: (el: HTMLElement | null) => void }) {
  return (
    <section id={section.id} ref={refCallback} className="card-military scroll-mt-20">
      <div className="flex items-center gap-3 mb-3">
        <SectionIcon section={section} size={36} />
        <div>
          <span className="text-military-steel text-[10px] uppercase tracking-wider">{section.category}</span>
          <h2 className="text-lg font-black text-military-gold uppercase tracking-wide">{section.title}</h2>
        </div>
      </div>

      {section.images && section.images.length > 0 && (
        <div className="flex gap-3 flex-wrap mb-4">
          {section.images.map((img, i) => (
            <figure key={i} className="w-24 text-center">
              <div className="bg-military-darker border border-military-steel rounded p-2 mb-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.src} alt={img.caption} className="w-full h-16 object-contain" />
              </div>
              <figcaption className="text-military-steel text-[10px] leading-tight">{img.caption}</figcaption>
            </figure>
          ))}
        </div>
      )}

      <ul className="space-y-2 list-disc list-inside mb-3">
        {section.body.map((line, i) => (
          <li key={i} className="text-sm text-military-steel leading-relaxed">{line}</li>
        ))}
      </ul>

      {section.tips && section.tips.length > 0 && (
        <div className="bg-military-dark/60 border-l-2 border-military-gold px-3 py-2 space-y-1.5">
          {section.tips.map((tip, i) => (
            <p key={i} className="text-xs text-military-tan leading-relaxed">💡 {tip}</p>
          ))}
        </div>
      )}
    </section>
  );
}
