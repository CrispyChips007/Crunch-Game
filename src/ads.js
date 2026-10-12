export function adVisibility(config, viewportWidth = 1024) {
  const usable = config.adsEnabled && (config.adPlaceholderMode || config.provider);
  return {
    header: Boolean(usable && config.showHeaderAd && !(config.hideHeaderAdOnSmallScreens && viewportWidth < 420)),
    sidebar: Boolean(usable && config.showSidebarAd && viewportWidth >= 1000),
    below: Boolean(usable && config.showBelowGameAd),
  };
}

export function renderAds(config, root = document, viewportWidth = innerWidth) {
  const visibility = adVisibility(config, viewportWidth);
  Object.entries(visibility).forEach(([name, visible]) => {
    const slot = root.querySelector(`[data-ad-slot="${name}"]`);
    if (!slot) return;
    slot.hidden = !visible;
    slot.textContent = config.adPlaceholderMode && visible ? "Advertisement" : "";
  });
  return visibility;
}

// Future providers should expose mount(slotElement, placementName). The game never
// imports provider code: integration belongs in this module only.
