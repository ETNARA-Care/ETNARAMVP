import "@testing-library/jest-dom/vitest";

// jsdom no implementa scrollIntoView -- limitación conocida del entorno de
// test, no de la aplicación. Shim estándar recomendado por testing-library.
if (typeof Element !== "undefined" && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
