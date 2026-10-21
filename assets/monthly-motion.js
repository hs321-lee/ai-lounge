"use strict";
// Progressive enhancement: every scene is visible without this script.
// Adds a one-time rise when a scene enters, a progress rail, and ←/→ scene navigation.
window.MonthlyMotion = {
  mount(root) {
    const scenes = [...root.querySelectorAll("[data-scene]")];
    const story = root.querySelector(".monthly-story");
    const rail = root.querySelector(".story-progress span");
    const header = document.querySelector(".site-header");
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let observer;
    let frame = 0;
    const setHeaderHeight = () => story?.style.setProperty("--header-h", `${header?.offsetHeight || 76}px`);
    const paintProgress = () => {
      frame = 0;
      if (!rail || media.matches) return;
      const bounds = root.getBoundingClientRect();
      const distance = Math.max(1, root.scrollHeight - window.innerHeight);
      rail.style.transform = `scaleY(${Math.min(1, Math.max(0, -bounds.top / distance))})`;
    };
    const onScroll = () => { if (!frame) frame = window.requestAnimationFrame(paintProgress); };
    const onResize = () => { setHeaderHeight(); onScroll(); };
    const goTo = index => {
      const target = scenes[Math.max(0, Math.min(scenes.length - 1, index))];
      target?.scrollIntoView({ behavior: media.matches ? "auto" : "smooth", block: "start" });
    };
    const currentIndex = () => {
      const offset = (header?.offsetHeight || 0) + 8;
      let current = 0;
      scenes.forEach((scene, index) => { if (scene.getBoundingClientRect().top <= offset + 4) current = index; });
      return current;
    };
    const onKey = event => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      if (root.querySelector(".story-viewer[open]") || event.target.closest?.("input,select,textarea,dialog")) return;
      const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
      if (!step) return;
      event.preventDefault();
      goTo(currentIndex() + step);
    };
    const onJump = event => {
      const button = event.target.closest?.("[data-jump]");
      if (!button || !root.contains(button)) return;
      const target = root.querySelector(`#scene-${Number(button.dataset.jump)}`);
      target?.scrollIntoView({ behavior: media.matches ? "auto" : "smooth", block: "start" });
    };
    setHeaderHeight();
    if (!media.matches && "IntersectionObserver" in window) {
      observer = new IntersectionObserver(entries => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-in");
          observer.unobserve(entry.target);
        }
      }, { threshold: 0 });
      scenes.forEach(scene => { if (scene.getBoundingClientRect().top > window.innerHeight) observer.observe(scene); });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });
    document.addEventListener("keydown", onKey);
    root.addEventListener("click", onJump);
    paintProgress();
    return () => {
      observer?.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("keydown", onKey);
      root.removeEventListener("click", onJump);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }
};
