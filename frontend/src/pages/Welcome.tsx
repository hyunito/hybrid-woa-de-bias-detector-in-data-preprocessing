import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import Carousel from "../components/Carousel";

// Shared layout: text on the left (flexible), icon on the right (never shrinks)
const Slide = ({
  icon,
  alt = "",
  iconClass = "h-72",
  children,
}: {
  icon: string;
  alt?: string;
  iconClass?: string;
  children: ReactNode;
}) => (
  <div className="w-full flex flex-col sm:flex-row items-start sm:items-center justify-between gap-8">
    <div className="flex-1 min-w-0">{children}</div>
    <img
      src={icon}
      alt={alt}
      aria-hidden={alt === "" ? true : undefined}
      className={`${iconClass} w-auto shrink-0 select-none`}
    />
  </div>
);

const hero = (
  <Slide icon="/icons/welcome-icon.png" alt="PROBA Logo">
    <h1 className="text-5xl font-bold text-[#0F1B2B]">
      Keep track of bias<br />in your dataset.
    </h1>
    <p className="mt-8 text-base text-[#1E293B]">
      PROBA records every transformation in your dataset<br />and flags the ones that cause bias.
    </p>
    <NavLink
      to="/dashboard"
      className="mt-8 inline-flex text-xs font-bold text-[#0F1B2B] bg-[#ECEEF1] hover:bg-slate-200 border border-slate-300 rounded-xl px-7 py-2 shadow-xs transition-all cursor-pointer active:scale-95 disabled:opacity-50 items-center gap-1.5"
    >
      Get started
    </NavLink>
  </Slide>
);

const steps = [
  {
    title: "Load Your Dataset",
    body: "Upload the dataset you want to clean and monitor for bias.",
  },
  {
    title: "Add Your Pipeline Scripts",
    body: "Load the Python scripts that clean your data. Each one is tracked as a step in the pipeline.",
  },
  {
    title: "Set Protected Attributes and Target Variable",
    body: "Choose the attributes to monitor for bias (such as age, sex or race), and define the target variable's favorable and unfavorable outcomes.",
  },
  {
    title: "Run and Review Results",
    body: "PROBA runs your scripts and logs every transformation, so you can see exactly where bias appears along with recommendations for fixing it.",
  },
];

const stepSlide = (n: number, title: string, body: string) => (
  <Slide icon={`/icons/step-${n}-icon.png`} iconClass="h-56">
    <p className="mb-3 text-base font-bold uppercase tracking-wide text-slate-500">
      Step {n} of {steps.length}
    </p>
    <h2 className="text-5xl font-bold text-[#0F1B2B]">{title}</h2>
    <p className="mt-8 text-base text-[#1E293B] max-w-xl">{body}</p>
  </Slide>
);

const slides = [
  hero,
  ...steps.map((s, i) => stepSlide(i + 1, s.title, s.body)),
];

export default function Welcome() {
  return (
    <div className="flex flex-col h-full min-h-[34rem] max-w-7xl mx-auto w-full">
      <Carousel slides={slides} />
    </div>
  );
}