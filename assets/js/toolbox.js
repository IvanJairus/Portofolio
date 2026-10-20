/*
  Production Mileage Toolbox Interactive Filter Controls
  Vanilla JS ES Module with zero external runtime dependencies.
  Satisfies min 44x44px touch targets, aria-pressed states, and zero layout shift.
*/

(function () {
  "use strict";

  function initToolboxFilter() {
    var grid = document.querySelector(".skill-grid");
    var filterBar = document.querySelector(".tier-filter");
    if (!grid || !filterBar) return;

    var items = [].slice.call(grid.querySelectorAll(".skill-item"));
    var groups = [].slice.call(grid.querySelectorAll(".skill-group"));
    var buttons = [].slice.call(filterBar.querySelectorAll("[data-filter]"));

    function getTier(item) {
      if (item.dataset.tier) return item.dataset.tier;
      var badge = item.querySelector(".tier");
      if (!badge) return "";
      if (badge.classList.contains("t-daily")) return "daily";
      if (badge.classList.contains("t-regular")) return "regular";
      if (badge.classList.contains("t-exposure")) return "exposure";
      return "";
    }

    function applyFilter(tier) {
      // Toggle visibility on individual skill items
      items.forEach(function (item) {
        var itemTier = getTier(item);
        var matches = (tier === "all" || itemTier === tier);
        if (matches) {
          item.removeAttribute("hidden");
          item.style.display = "";
        } else {
          item.setAttribute("hidden", "");
          item.style.display = "none";
        }
      });

      // Suppress empty skill groups when none of their items match
      groups.forEach(function (group) {
        var groupItems = [].slice.call(group.querySelectorAll(".skill-item"));
        var hasVisible = groupItems.some(function (it) {
          return it.style.display !== "none" && !it.hasAttribute("hidden");
        });
        if (hasVisible) {
          group.removeAttribute("hidden");
          group.style.display = "";
        } else {
          group.setAttribute("hidden", "");
          group.style.display = "none";
        }
      });

      // Update button aria-pressed states and active classes
      buttons.forEach(function (btn) {
        var isActive = (btn.dataset.filter === tier);
        btn.setAttribute("aria-pressed", String(isActive));
        btn.classList.toggle("active", isActive);
      });
    }

    // Attach click listeners to all filter chip buttons
    buttons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        applyFilter(btn.dataset.filter);
      });
    });

    // Initial state: daily weapons selected by default (matches HTML markup)
    var initialBtn = buttons.filter(function (btn) {
      return btn.getAttribute("aria-pressed") === "true";
    })[0];
    var initialTier = initialBtn ? initialBtn.dataset.filter : "daily";
    applyFilter(initialTier);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initToolboxFilter);
  } else {
    initToolboxFilter();
  }
})();
