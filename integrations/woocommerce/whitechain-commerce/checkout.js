(() => {
  const name = "whitechain_commerce";
  const settings = window.wc.wcSettings.getSetting(name + "_data", {});
  const description = window.wp.element.createElement("span", null, settings.description);

  window.wc.wcBlocksRegistry.registerPaymentMethod({
    name,
    label: settings.title,
    ariaLabel: settings.title,
    content: description,
    edit: description,
    canMakePayment: ({ cartTotals }) => cartTotals?.currency_code === "USD",
    supports: { features: ["products"] },
  });
})();
