"use strict";
// Progressive enhancement: text is visible by default, before motion is available.
window.MonthlyMotion = {
  mount(root) {
    const panels = [...root.querySelectorAll("[data-reveal]")];
    const rail = root.querySelector(".story-progress span");
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let observer;
    let frame = 0;
    let disposed = false;
    const showAll = () => panels.forEach(panel => panel.classList.remove("reveal-pending"));
    const paintProgress = () => {
      frame = 0;
      if (disposed || media.matches || !rail) return;
      const bounds = root.getBoundingClientRect();
      const viewport = window.innerHeight;
      const distance = Math.max(1, root.scrollHeight - viewport);
      const ratio = Math.min(1, Math.max(0, -bounds.top / distance));
      rail.style.transform = `scaleY(${ratio})`;
    };
    const onScroll = () => { if (!frame) frame = window.requestAnimationFrame(paintProgress); };
    const stop = () => {
      observer?.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
      showAll();
    };
    const onMotionChange = () => { if (media.matches) stop(); };
    if (!media.matches && "IntersectionObserver" in window) {
      try {
        observer = new IntersectionObserver(entries => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              entry.target.classList.remove("reveal-pending");
              observer.unobserve(entry.target);
            }
          }
        }, { threshold: 0.12, rootMargin: "0px 0px -4% 0px" });
        for (const panel of panels) {
          if (panel.getBoundingClientRect().top >= window.innerHeight) panel.classList.add("reveal-pending");
          observer.observe(panel);
        }
        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("resize", onScroll, { passive: true });
        media.addEventListener?.("change", onMotionChange);
        paintProgress();
      } catch { stop(); }
    }
    return () => {
      disposed = true;
      stop();
      media.removeEventListener?.("change", onMotionChange);
    };
  }
};
