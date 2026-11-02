import type { FilterSpecification } from "maplibre-gl";
import type { LayerId } from "./layers";

/** Religion views read the one OSM places-of-worship extract, split by its `religion` tag (no copied files). */
export const RELIGION_VIEWS: Readonly<Partial<Record<LayerId, FilterSpecification>>> = {
  churches: ["==", ["get", "religion"], "christian"],
  mosques: ["==", ["get", "religion"], "muslim"],
  "other-religious": ["!", ["in", ["coalesce", ["get", "religion"], ""], ["literal", ["christian", "muslim"]]]],
};
