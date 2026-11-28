"use strict";
// Progressive enhancement: every scene is visible without this script.
// Adds a one-time rise when a scene enters, a progress rail, and ←/→ scene navigation.
// 발표(seminar-deck)에서는 슬라이드에 들어올 때마다 그 장의 모션을 한 번 재생합니다(style.css '슬라이드 전환').

// 글자를 한 자씩 감싸되 단어째 묶어 줄바꿈(keep-all)을 지킵니다. 읽기 프로그램에는 원래 문장으로 읽힙니다.
function splitChars(element) {
  const text = element.textContent;
  element.setAttribute("aria-label", text.replace(/\s+/g, " ").trim());
  element.textContent = "";
  let index = 0;
  for (const part of text.split(/(\s+)/)) {
    if (!part) continue;
    if (/^\s+$/.test(part)) { element.append(part); continue; }
    const word = document.createElement("span");
    word.className = "m-word";
    word.setAttribute("aria-hidden", "true");
    for (const character of part) {
      const span = document.createElement("span");
      span.className = "m-char";
      span.style.setProperty("--i", index++);
      span.textContent = character;
      word.append(span);
    }
    element.append(word);
  }
}
// "A → B → C" 문장을 단계와 화살표로 나눕니다. 문구는 그대로입니다.
function splitSteps(element) {
  const parts = element.textContent.split(" → ");
  if (parts.length < 2) return;
  element.textContent = "";
  parts.forEach((part, index) => {
    if (index) {
      const arrow = document.createElement("span");
      arrow.className = "m-arrow";
      arrow.style.setProperty("--i", index);
      arrow.textContent = "→";
      element.append(" ", arrow, " ");
    }
    const step = document.createElement("span");
    step.className = "m-step";
    step.style.setProperty("--i", index);
    step.textContent = part;
    element.append(step);
  });
}
function prepareSlides(story) {
  story.querySelectorAll(".story-cover h1, .slide-recap-stage h2").forEach(splitChars);
  story.querySelectorAll(".slide-copy .slide-body").forEach(splitSteps);
  story.querySelectorAll(".slide-dark .slide-copy h2").forEach(heading => {
    const lines = heading.textContent.split("\n");
    heading.setAttribute("aria-label", lines.join(" "));
    heading.textContent = "";
    lines.forEach((line, index) => {
      const span = document.createElement("span");
      span.className = "m-line";
      span.setAttribute("aria-hidden", "true");
      span.style.setProperty("--i", index);
      span.textContent = line;
      heading.append(span);
    });
  });
  const index = (selector, scope = story, name = "--i") => scope.querySelectorAll(selector).forEach((node, i) => node.style.setProperty(name, i));
  story.querySelectorAll(".slide-schedule").forEach(schedule => {
    index(".calendar-bar", schedule);
    schedule.style.setProperty("--bars", schedule.querySelectorAll(".calendar-bar").length);
  });
  story.querySelectorAll(".slide-code").forEach(code => index("mark", code));
  story.querySelectorAll(".slide-course-path>li").forEach((course, i) => { course.style.setProperty("--c", i); index(".course-path-keywords li", course); });
  story.querySelectorAll(".recap-figure").forEach((figure, i) => figure.style.setProperty("--i", i));
  story.querySelectorAll(".summary-areas>li").forEach((area, i) => { area.style.setProperty("--g", i); index("li", area, "--t"); });
  index(".summary-takeaways>div");
  index(".slide-stage>.slide-numbers>div");
  story.querySelectorAll(".seminar-cover-benefits").forEach(benefits => {
    const shapes = document.createElement("span");
    shapes.className = "cover-shapes";
    shapes.setAttribute("aria-hidden", "true");
    shapes.innerHTML = "<i></i><i></i><i></i>";
    benefits.prepend(shapes);
    index("dd", benefits);
  });
}

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
    // 지금 장에 is-current를 다시 붙여 CSS 모션을 처음부터 재생합니다.
    const animated = slides && !media.matches && "IntersectionObserver" in window;
    let current;
    const enter = scene => {
      if (!animated || !scene || scene === current) return;
      current?.classList.remove("is-current");
      scene.classList.remove("is-current");
      void scene.offsetWidth;
      scene.classList.add("is-current");
      current = scene;
    };
    const goTo = index => {
      const target = scenes[Math.max(0, Math.min(scenes.length - 1, index))];
      enter(target);
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
      enter(target);
      if (slides) target?.focus({ preventScroll: true });
      target?.scrollIntoView({ behavior: slides ? "instant" : media.matches ? "auto" : "smooth", block: "start" });
    };
    setHeaderHeight();
    let slideObserver;
    if (animated) {
      prepareSlides(story);
      story.classList.add("motion-ready");
      slideObserver = new IntersectionObserver(entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) enter(entry.target);
          else if (entry.target === current) { current.classList.remove("is-current"); current = undefined; }
        }
      }, { rootMargin: "-50% 0px -50% 0px", threshold: 0 }); // 화면 가운데 선을 지나는 장 하나
      scenes.forEach(scene => slideObserver.observe(scene));
    }
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
      slideObserver?.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("keydown", onKey);
      root.removeEventListener("click", onJump);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }
};
