import { useState, type ReactNode } from "react";

export default function Carousel({ slides }: { slides: ReactNode[] }) {
  const [index, setIndex] = useState(0);

  const next = () => setIndex((i) => Math.min(i + 1, slides.length - 1));
  const prev = () => setIndex((i) => Math.max(i - 1, 0));

  const isFirst = index === 0;
  const isLast = index === slides.length - 1;

  return (
    <div className="flex-1 flex flex-col bg-white rounded-3xl border border-slate-200/90 shadow-md overflow-hidden">
      {/* Viewport */}
      <div className="flex-1 overflow-hidden">
        {/* Track */}
        <div
          className="flex h-full transition-transform duration-300 ease-in-out"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {slides.map((slide, i) => (
            <div key={i} className="min-w-full h-full flex items-center px-12 py-8">
              {slide}
            </div>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4 pb-6">
        {/* Previous: hidden on the first slide, but still takes up space so the dots don't shift */}
        <button
          onClick={prev}
          disabled={isFirst}
          aria-label="Previous slide"
          className={`p-2 rounded-full text-[#0F1B2B] hover:bg-slate-200 transition-all cursor-pointer active:scale-95 ${
            isFirst ? "invisible" : ""
          }`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        <div className="flex items-center gap-2">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              aria-label={`Go to slide ${i + 1}`}
              className={`h-2.5 rounded-full transition-all cursor-pointer ${
                i === index ? "w-6 bg-[#0F1B2B]" : "w-2.5 bg-slate-300 hover:bg-slate-400"
              }`}
            />
          ))}
        </div>

        {/* Next: hidden on the last slide, but still takes up space so the dots don't shift */}
        <button
          onClick={next}
          disabled={isLast}
          aria-label="Next slide"
          className={`p-2 rounded-full text-[#0F1B2B] hover:bg-slate-200 transition-all cursor-pointer active:scale-95 ${
            isLast ? "invisible" : ""
          }`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
    </div>
  );
}