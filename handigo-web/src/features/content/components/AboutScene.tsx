import { useEffect, useRef, type CSSProperties } from "react";
import { Check, HeartHandshake, House, ShieldCheck, Sparkles, Wrench } from "lucide-react";
import "./about-scene.css";

interface AboutSceneProps {
  variant: "home" | "journey";
}

/** Các mặt khối dùng CSS 3D; chuyển động không phụ thuộc dữ liệu hoặc ảnh ngoài. */
export function AboutScene({ variant }: AboutSceneProps) {
  const sceneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const motion = window.matchMedia("(prefers-reduced-motion: no-preference) and (hover: hover) and (pointer: fine)");
    let frame = 0;
    let bounds: DOMRect | undefined;
    const reset = () => {
      cancelAnimationFrame(frame);
      bounds = undefined;
      scene.style.removeProperty("--scene-rx");
      scene.style.removeProperty("--scene-ry");
    };
    const move = (event: PointerEvent) => {
      if (!motion.matches || event.pointerType !== "mouse") return;
      bounds ??= scene.getBoundingClientRect();
      const x = Math.max(-1, Math.min(1, (event.clientX - bounds.left) / bounds.width * 2 - 1));
      const y = Math.max(-1, Math.min(1, (event.clientY - bounds.top) / bounds.height * 2 - 1));
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        scene.style.setProperty("--scene-rx", `${-16 - y * 9}deg`);
        scene.style.setProperty("--scene-ry", `${-28 + x * 16}deg`);
      });
    };
    scene.addEventListener("pointermove", move, { passive: true });
    scene.addEventListener("pointerleave", reset);
    window.addEventListener("scroll", reset, { passive: true });
    window.addEventListener("resize", reset);
    motion.addEventListener("change", reset);
    return () => {
      reset();
      scene.removeEventListener("pointermove", move);
      scene.removeEventListener("pointerleave", reset);
      window.removeEventListener("scroll", reset);
      window.removeEventListener("resize", reset);
      motion.removeEventListener("change", reset);
    };
  }, []);

  return (
    <figure className="about-scene-figure">
      <div ref={sceneRef} className={`about-scene about-scene--${variant}`} aria-hidden="true">
        <div className="about-scene-halo" />
        <div className="about-scene-world">
          <div className="about-scene-ground" />
          {variant === "home" ? (
            <>
              <div className="about-house">
                <div className="about-house-front"><div className="about-house-window" /><div className="about-house-door"><span /></div></div>
                <div className="about-house-side"><div className="about-house-window" /></div>
                <div className="about-house-roof"><House size={36} strokeWidth={1.3} /></div>
                <div className="about-house-sign"><HeartHandshake size={20} /><span>Handigo</span></div>
              </div>
              <div className="about-scene-tree"><span /><i /></div>
              <div className="about-scene-tile about-scene-tile--one"><Wrench size={26} /></div>
              <div className="about-scene-tile about-scene-tile--two"><ShieldCheck size={28} /></div>
              <div className="about-scene-tile about-scene-tile--three"><Sparkles size={24} /></div>
            </>
          ) : (
            <>
              {[House, HeartHandshake, ShieldCheck].map((Icon, index) => (
                <div key={index} className="about-step" style={{ "--step": index } as CSSProperties}>
                  <div className="about-step-front"><span>0{index + 1}</span></div>
                  <div className="about-step-side" />
                  <div className="about-step-top" />
                  <div className="about-step-icon"><Icon size={30} strokeWidth={1.5} /></div>
                </div>
              ))}
              <div className="about-scene-tile about-scene-tile--three"><Check size={25} /></div>
            </>
          )}
        </div>
      </div>
      <figcaption className="about-scene-caption">
        {variant === "home" ? "Kết nối tận tâm, chăm sóc từng mái nhà." : "Từng bước xây dựng niềm tin."}
      </figcaption>
    </figure>
  );
}
