document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-menu-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const target = document.querySelector(button.dataset.menuToggle);
      if (target) target.classList.toggle("is-open");
    });
  });

  document.querySelectorAll("[data-scroll-top]").forEach((button) => {
    button.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  document.querySelectorAll("[data-year]").forEach((el) => {
    el.textContent = new Date().getFullYear();
  });
});
