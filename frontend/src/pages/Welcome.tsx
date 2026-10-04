import { NavLink } from "react-router-dom";
import Flashcards from "../components/Carousel";

const hero = (
  <div className="w-full flex flex-col sm:flex-row items-start sm:items-center justify-between gap-8">
    <div className="min-w-0">
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
    </div>
    <div className="flex-1 flex justify-end">
      <img
        src="/icons/welcome-icon.png"
        alt="PROBA Logo"
        className="h-72 w-auto"
      />
    </div>
  </div>
);

const steps = [
  {
    title: "Load Your Dataset",
    body: "Upload the dataset you want to clean and monitor for bias.",
  },
  {
    title: "Add Your Pipeline Scripts",
    body: "Load the scripts that clean your data. Each one is tracked as a step in the pipeline.",
  },
  {
    title: "Set Protected Attributes and Target Variable",
    body: "Choose the attributes to monitor for bias (such as gender or age) and the target variable you want to predict.",
  },
  {
    title: "Run and Review Results",
    body: "PROBA runs your scripts and logs every transformation, so you can see exactly where bias appears along with recommendations for fixing it.",
  },
];

const stepSlide = (n: number, title: string, body: string) => (
  <div className="w-full flex items-center justify-between gap-8">
    <div className="min-w-0 max-w-2xl">
      <p className="text-sm font-bold uppercase tracking-wide text-[#4A9AD3]">
        Step {n} of {steps.length}
      </p>
      <h2 className="mt-3 text-4xl font-bold text-[#0F1B2B]">{title}</h2>
      <p className="mt-6 text-base text-[#1E293B]">{body}</p>
    </div>
    <span
      aria-hidden="true"
      className="hidden sm:block text-[10rem] leading-none font-bold text-[#243F85]/10 select-none"
    >
      {n}
    </span>
  </div>
);

const slides = [
  hero,
  ...steps.map((s, i) => stepSlide(i + 1, s.title, s.body)),
];

export default function Welcome() {
  return (
    <div className="flex flex-col h-full min-h-[34rem] max-w-7xl mx-auto w-full">
      <Flashcards slides={slides} />
    </div>
  );
}