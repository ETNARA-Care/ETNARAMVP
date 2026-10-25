import "i18next";
import type { resources } from "./index";

// Type-checked keys: t("auth:login.submit") fails to compile if the key does not exist in Spanish.
declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "common";
    resources: (typeof resources)["es"];
  }
}
