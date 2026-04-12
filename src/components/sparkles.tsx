"use client";

import type { Container, SingleOrMultiple } from "@tsparticles/engine";
import Particles, { initParticlesEngine } from "@tsparticles/react";
import { loadSlim } from "@tsparticles/slim";
import { motion, useAnimation } from "framer-motion";
import { useEffect, useId, useState } from "react";

interface SparklesCoreProps {
  id?: string;
  className?: string;
  background?: string;
  minSize?: number;
  maxSize?: number;
  speed?: number;
  particleColor?: string;
  particleDensity?: number;
}

export function SparklesCore({
  id,
  className,
  background = "transparent",
  minSize = 0.2,
  maxSize = 0.8,
  speed = 4,
  particleColor = "#95D2E6",
  particleDensity = 600,
}: SparklesCoreProps) {
  const [init, setInit] = useState(false);
  const controls = useAnimation();
  const generatedId = useId();

  useEffect(() => {
    initParticlesEngine(async (engine) => {
      await loadSlim(engine);
    }).then(() => setInit(true));
  }, []);

  const particlesLoaded = async (container?: Container) => {
    if (container) {
      controls.start({ opacity: 1, transition: { duration: 1 } });
    }
  };

  return (
    <motion.div animate={controls} className={`opacity-0 ${className || ""}`}>
      {init && (
        <Particles
          id={id || generatedId}
          className="h-full w-full"
          particlesLoaded={particlesLoaded}
          options={{
            background: { color: { value: background } },
            fullScreen: { enable: false, zIndex: 1 },
            fpsLimit: 120,
            interactivity: {
              events: {
                onClick: { enable: true, mode: "push" as const },
                onHover: { enable: false, mode: "repulse" as const },
                resize: true as unknown as Record<string, unknown>,
              },
              modes: {
                push: { quantity: 4 },
                repulse: { distance: 200, duration: 0.4 },
              },
            },
            particles: {
              color: { value: particleColor },
              move: {
                enable: true,
                direction: "none" as const,
                straight: false,
                random: false,
                speed: { min: 0.1, max: 1 },
                outModes: { default: "out" as const },
              },
              number: {
                density: { enable: true, width: 400, height: 400 },
                value: particleDensity,
              },
              opacity: {
                value: { min: 0.1, max: 1 },
                animation: {
                  enable: true,
                  speed: speed,
                  sync: false,
                  startValue: "random" as const,
                  mode: "auto" as const,
                } as unknown as Record<string, unknown>,
              },
              shape: { type: "circle" as SingleOrMultiple<string> },
              size: { value: { min: minSize, max: maxSize } },
            } as unknown as Record<string, unknown>,
            detectRetina: true,
          }}
        />
      )}
    </motion.div>
  );
}
