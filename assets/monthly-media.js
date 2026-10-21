"use strict";
window.MonthlyMedia = {
  mount(root, sections) {
    const viewer = root.querySelector(".story-viewer");
    if (!viewer || typeof viewer.showModal !== "function") return () => {};
    const image = viewer.querySelector(".story-viewer-image");
    const caption = viewer.querySelector(".story-viewer-caption");
    const closeButton = viewer.querySelector("[data-viewer-close]");
    let trigger;
    const close = () => { if (viewer.open) viewer.close(); };
    const restoreFocus = () => { if (trigger?.isConnected) trigger.focus(); };
    const onOpen = event => {
      const link = event.target.closest?.("[data-media-index]");
      if (!link || !root.contains(link)) return;
      const media = sections[Number(link.dataset.mediaIndex)]?.media;
      if (!media) return;
      event.preventDefault();
      trigger = link;
      viewer.classList.toggle("is-detail", media.width < 800);
      image.width = media.width;
      image.height = media.height;
      image.src = media.src;
      image.alt = media.alt;
      caption.textContent = media.caption;
      viewer.showModal();
    };
    const onBackdrop = event => { if (event.target === viewer) close(); };
    root.addEventListener("click", onOpen);
    viewer.addEventListener("click", onBackdrop);
    viewer.addEventListener("close", restoreFocus);
    closeButton.addEventListener("click", close);
    return () => {
      root.removeEventListener("click", onOpen);
      viewer.removeEventListener("click", onBackdrop);
      viewer.removeEventListener("close", restoreFocus);
      closeButton.removeEventListener("click", close);
      trigger = undefined;
      close();
    };
  }
};
