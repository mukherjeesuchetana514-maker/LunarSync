"use client";

import { animate, motion, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Crosshair } from "lucide-react";
import { HeroVisual } from "./hero-visual";
import { useBootStore } from "@/store/boot-store";

const WORDS = ["Different", "sun.", "Different", "scale.", "Same", "ground."];

function Stat({
  value,
  prefix = "",
  suffix = "",
  sr,
  label,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  sr: string;
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduced = useReducedMotion();
  const booted = useBootStore((s) => s.booted);
  const [display, setDisplay] = useState(`${prefix}0${suffix}`);

  useEffect(() => {
    if (!inView || !booted) return;
    if (reduced) {
      setDisplay(`${prefix}${value}${suffix}`);
      return;
    }
    const controls = animate(0, value, {
      duration: 1.4,
      ease: [0.22, 0.61, 0.36, 1],
      onUpdate: (v) => setDisplay(`${prefix}${Math.round(v)}${suffix}`),
    });
    return () => controls.stop();
  }, [inView, booted, reduced, value, prefix, suffix]);

  return (
    <div ref={ref}>
      <dt className="sr-only">{sr}</dt>
      <dd className="tabular font-mono text-lg text-bone">{display}</dd>
      <dd className="font-mono text-[10px] tracking-[0.12em] text-ash">{label}</dd>
    </div>
  );
}

export function Hero() {
  const reduced = useReducedMotion();
  const booted = useBootStore((s) => s.booted);

  return (
    <section id="top" className="relative">
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 pb-16 pt-12 sm:px-8 sm:pb-24 sm:pt-16 lg:grid-cols-[0.88fr_1.18fr] lg:gap-10">
        <div className="max-w-[48ch]">
          <motion.div
            initial={reduced ? false : { opacity: 0, y: 10 }}
            animate={booted ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 rounded-full px-3 py-1 font-mono text-[11px] tracking-[0.18em] text-signal ring-1 ring-signal/25"
          >
            <span className="reticle size-1.5 rounded-full bg-signal" />
            SUN-ANGLE · SCALE · VIEWPOINT INVARIANT
          </motion.div>

          <h1 className="mt-6 text-[2.4rem] font-semibold leading-[1.04] tracking-tight text-balance sm:text-[3.1rem] xl:text-[3.5rem]">
            {WORDS.map((word, i) => (
              <motion.span
                key={i}
                className={`inline-block ${
                  i > 3
                    ? "text-signal [text-shadow:0_0_32px_color-mix(in_oklab,var(--signal)_60%,transparent)]"
                    : ""
                }`}
                initial={reduced ? false : { opacity: 0, y: 16 }}
                animate={booted ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: 0.1 + i * 0.07, ease: [0.22, 0.61, 0.36, 1] }}
              >
                {word}
                {i < WORDS.length - 1 ? "\u00A0" : ""}
              </motion.span>
            ))}
          </h1>

          <motion.p
            initial={reduced ? false : { opacity: 0, y: 12 }}
            animate={booted ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.55 }}
            className="mt-5 max-w-[46ch] text-pretty text-base text-mist sm:text-lg"
          >
            LunarSync finds which pixel in a Chandrayaan-2 image is which pixel in a
            lunar reference image — across a 300× resolution gap, opposite shadow
            directions and different viewing geometry — then warps the source frame
            into register and reports how good the fit actually is.
          </motion.p>

          <motion.div
            initial={reduced ? false : { opacity: 0, y: 12 }}
            animate={booted ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.65 }}
            className="mt-8 flex flex-wrap items-center gap-3"
          >
            <a
              href="#pipeline"
              className="group inline-flex items-center gap-2 rounded-md bg-signal px-5 py-3 font-mono text-sm font-semibold text-void ring-1 ring-signal/40 transition-all hover:bg-bone hover:shadow-[0_8px_32px_-8px_var(--bone)] shadow-[0_8px_32px_-8px_var(--signal)]"
            >
              Walk the pipeline
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </a>
            <Link
              href="/visualize"
              className="inline-flex items-center gap-2 rounded-md px-5 py-3 font-mono text-sm font-medium text-bone ring-1 ring-line transition-colors hover:ring-mist"
            >
              <Crosshair className="size-4" />
              Visualize Matches
            </Link>
            <Link
              href="/localize"
              className="inline-flex items-center gap-2 rounded-md px-5 py-3 font-mono text-sm font-medium text-bone ring-1 ring-line transition-colors hover:ring-mist"
            >
              Try Localizer
            </Link>
            <a
              href="#problem"
              className="inline-flex items-center gap-2 rounded-md px-5 py-3 font-mono text-sm font-medium text-bone ring-1 ring-line transition-colors hover:ring-mist"
            >
              Why it is hard
            </a>
          </motion.div>

          <motion.dl
            initial={reduced ? false : { opacity: 0 }}
            animate={booted ? { opacity: 1 } : {}}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="mt-9 grid max-w-md grid-cols-3 gap-4 border-t border-line/60 pt-5"
          >
            <Stat value={300} prefix="~" suffix="×" sr="Scale gap between the coarsest and finest sensors" label="SCALE GAP IIRS↔OHRC" />
            <Stat value={3} sr="Chandrayaan-2 optical payloads supported as source" label="CH-2 SOURCE SENSORS" />
            <Stat value={3} sr="Required deliverables" label="REQUIRED OUTPUTS" />
          </motion.dl>
        </div>

        <div className="lg:-mt-25">
          <HeroVisual />
        </div>
      </div>
    </section>
  );
}
