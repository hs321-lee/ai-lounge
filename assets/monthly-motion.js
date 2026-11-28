"use strict";
// Progressive enhancement: every scene is visible without this script.
// Adds a one-time rise when a scene enters, a progress rail, and ←/→ scene navigation.
window.MonthlyMotion = {
  mount(root) {
    const scenes = [...root.querySelectorAll("[data-scene]")];
    const story = root.querySelector(".monthly-story");
    const slides = story?.classList.contains("seminar-deck");
    const rail = root.querySelector(".story-progress span");
    const header = document.querySelector(".menu-bar");
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
      if (slides) target?.focus({ preventScroll: true });
      target?.scrollIntoView({ behavior: slides ? "instant" : media.matches ? "auto" : "smooth", block: "start" });
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
      const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key] || (slides && { PageDown: 1, PageUp: -1 }[event.key]);
      if (!step) return;
      event.preventDefault();
      goTo(currentIndex() + step);
    };
    const onJump = event => {
      const arrow = event.target.closest?.("[data-slide-to]");
      if (slides && arrow && root.contains(arrow)) {
        goTo(Number(arrow.dataset.slideTo));
        return;
      }
      const button = event.target.closest?.("[data-jump]");
      if (!button || !root.contains(button)) return;
      const target = root.querySelector(`#scene-${Number(button.dataset.jump)}`);
      if (slides) target?.focus({ preventScroll: true });
      target?.scrollIntoView({ behavior: slides ? "instant" : media.matches ? "auto" : "smooth", block: "start" });
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
    // 3D 복습 장면: 화면에 들어오면 만들어지는 과정을 한 번 재생하고, 끝나면 고화질 정지 그림과 라벨로 넘깁니다.
    // 모션 감소 설정이거나 재생이 막히면 처음부터 정지 그림과 라벨만 보입니다.
    let stageObserver;
    const stages = [...root.querySelectorAll(".recap-stage")].filter(stage => stage.querySelector("video"));
    const finish = stage => stage.classList.remove("is-playing");
    const play = stage => {
      const video = stage.querySelector("video");
      video.currentTime = 0;
      video.addEventListener("playing", () => stage.classList.add("is-playing"), { once: true });
      video.play().catch(() => finish(stage));
    };
    stages.forEach(stage => stage.querySelector("video").addEventListener("ended", () => finish(stage)));
    if (!media.matches && "IntersectionObserver" in window && stages.length) {
      stageObserver = new IntersectionObserver(entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) play(entry.target);
          else { entry.target.querySelector("video").pause(); finish(entry.target); }
        }
      }, { threshold: 0.6 });
      stages.forEach(stage => stageObserver.observe(stage));
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });
    document.addEventListener("keydown", onKey);
    root.addEventListener("click", onJump);
    paintProgress();
    return () => {
      observer?.disconnect();
      stageObserver?.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("keydown", onKey);
      root.removeEventListener("click", onJump);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }
};
