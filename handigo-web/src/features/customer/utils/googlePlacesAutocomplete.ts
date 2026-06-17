export interface ParsedPlaceAddress {
  fullAddress: string;
  province: string;
  ward: string;
  latitude?: number;
  longitude?: number;
  placeId?: string;
}

interface GoogleAddressComponent {
  longText?: string;
  shortText?: string;
  long_name?: string;
  short_name?: string;
  types: string[];
}

interface GoogleLatLng {
  lat?: (() => number) | number;
  lng?: (() => number) | number;
}

interface GooglePlace {
  id?: string;
  place_id?: string;
  formattedAddress?: string;
  formatted_address?: string;
  displayName?: string | { text?: string };
  name?: string;
  addressComponents?: GoogleAddressComponent[];
  address_components?: GoogleAddressComponent[];
  location?: GoogleLatLng;
  geometry?: {
    location?: GoogleLatLng;
  };
  fetchFields?: (options: { fields: string[] }) => Promise<void>;
}

interface GooglePlacePrediction {
  toPlace: () => GooglePlace;
}

interface PlacePredictionSelectEvent extends Event {
  placePrediction?: GooglePlacePrediction;
  detail?: {
    placePrediction?: GooglePlacePrediction;
  };
}

interface PlaceAutocompleteElement extends HTMLElement {
  includedRegionCodes?: string[];
  placeholder?: string;
  value?: string;
}

interface PlacesLibrary {
  PlaceAutocompleteElement?: new () => PlaceAutocompleteElement;
}

interface GoogleMapsNamespace {
  maps?: {
    importLibrary?: (libraryName: "places") => Promise<PlacesLibrary>;
  };
}

declare global {
  interface Window {
    google?: GoogleMapsNamespace;
    __handigoGoogleMapsLoaded?: () => void;
  }
}

interface MountPlaceAutocompleteOptions {
  container: HTMLElement;
  value?: string;
  placeholder?: string;
  onInput?: (value: string) => void;
  onPlaceSelect: (address: ParsedPlaceAddress) => void;
}

const scriptId = "google-maps-js-sdk";
let mapsApiPromise: Promise<void> | null = null;
let placesLibraryPromise: Promise<PlacesLibrary> | null = null;

const readText = (component: GoogleAddressComponent) =>
  component.longText || component.long_name || component.shortText || component.short_name || "";

const getComponent = (
  components: GoogleAddressComponent[] | undefined,
  acceptedTypes: string[],
) =>
  components?.find((component) =>
    acceptedTypes.some((type) => component.types.includes(type)),
  )
    ? readText(
        components.find((component) =>
          acceptedTypes.some((type) => component.types.includes(type)),
        ) as GoogleAddressComponent,
      )
    : "";

const readLatLng = (value: GoogleLatLng | undefined) => {
  if (!value) return {};

  const lat = typeof value.lat === "function" ? value.lat() : value.lat;
  const lng = typeof value.lng === "function" ? value.lng() : value.lng;

  return { latitude: lat, longitude: lng };
};

const readDisplayName = (displayName: GooglePlace["displayName"]) =>
  typeof displayName === "string" ? displayName : displayName?.text;

export const parseGooglePlace = (place: GooglePlace): ParsedPlaceAddress => {
  const components = place.addressComponents || place.address_components;
  const location = place.location || place.geometry?.location;
  const { latitude, longitude } = readLatLng(location);

  return {
    fullAddress:
      place.formattedAddress ||
      place.formatted_address ||
      readDisplayName(place.displayName) ||
      place.name ||
      "",
    province: getComponent(components, ["administrative_area_level_1"]),
    ward: getComponent(components, [
      "sublocality_level_1",
      "administrative_area_level_3",
      "locality",
    ]),
    latitude,
    longitude,
    placeId: place.id || place.place_id,
  };
};

export const loadGoogleMapsApi = () => {
  if (window.google?.maps?.importLibrary) return Promise.resolve();
  if (mapsApiPromise) return mapsApiPromise;

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return Promise.reject(new Error("Missing VITE_GOOGLE_MAPS_API_KEY"));
  }

  mapsApiPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (existingScript) {
      if (window.google?.maps?.importLibrary) {
        resolve();
        return;
      }

      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener(
        "error",
        () => reject(new Error("Google Maps script failed to load")),
        { once: true },
      );
      return;
    }

    window.__handigoGoogleMapsLoaded = () => {
      resolve();
      delete window.__handigoGoogleMapsLoaded;
    };

    const params = new URLSearchParams({
      key: apiKey,
      loading: "async",
      v: "weekly",
      language: "vi",
      region: "VN",
      callback: "__handigoGoogleMapsLoaded",
    });

    const script = document.createElement("script");
    script.id = scriptId;
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.onerror = () => {
      mapsApiPromise = null;
      delete window.__handigoGoogleMapsLoaded;
      reject(new Error("Google Maps script failed to load"));
    };
    document.head.appendChild(script);
  });

  return mapsApiPromise;
};

export const loadPlacesNewLibrary = async () => {
  if (placesLibraryPromise) return placesLibraryPromise;

  placesLibraryPromise = loadGoogleMapsApi().then(async () => {
    const importLibrary = window.google?.maps?.importLibrary;
    if (!importLibrary) {
      throw new Error("Google Maps importLibrary is unavailable");
    }

    const placesLibrary = await importLibrary("places");
    if (!placesLibrary.PlaceAutocompleteElement) {
      throw new Error("Google PlaceAutocompleteElement is unavailable");
    }

    return placesLibrary;
  });

  return placesLibraryPromise;
};

const getAutocompleteValue = (
  autocomplete: PlaceAutocompleteElement,
  event?: Event,
) => {
  const targetValue = (event?.target as { value?: string } | null)?.value;
  const pathValue = (event?.composedPath?.()[0] as { value?: string } | undefined)
    ?.value;

  return targetValue ?? pathValue ?? autocomplete.value ?? "";
};

export const mountPlaceAutocompleteElement = async ({
  container,
  value,
  placeholder = "Nhập địa chỉ cụ thể",
  onInput,
  onPlaceSelect,
}: MountPlaceAutocompleteOptions) => {
  const { PlaceAutocompleteElement } = await loadPlacesNewLibrary();
  if (!PlaceAutocompleteElement) {
    throw new Error("Google PlaceAutocompleteElement is unavailable");
  }

  const autocomplete = new PlaceAutocompleteElement();
  autocomplete.id = "address-line-google-places";
  autocomplete.className = "google-place-autocomplete";
  autocomplete.includedRegionCodes = ["vn"];
  autocomplete.placeholder = placeholder;

  if (value) {
    autocomplete.value = value;
  }

  container.replaceChildren(autocomplete);

  const handleInput = (event: Event) => {
    onInput?.(getAutocompleteValue(autocomplete, event));
  };

  const handleSelect = async (event: Event) => {
    const selectEvent = event as PlacePredictionSelectEvent;
    const prediction =
      selectEvent.placePrediction || selectEvent.detail?.placePrediction;
    const place = prediction?.toPlace();

    if (!place) return;

    await place.fetchFields?.({
      fields: [
        "id",
        "displayName",
        "formattedAddress",
        "location",
        "addressComponents",
      ],
    });

    const parsedPlace = parseGooglePlace(place);
    autocomplete.value = parsedPlace.fullAddress || getAutocompleteValue(autocomplete);
    onPlaceSelect(parsedPlace);
  };

  autocomplete.addEventListener("input", handleInput);
  autocomplete.addEventListener("change", handleInput);
  autocomplete.addEventListener("gmp-select", handleSelect);

  return () => {
    autocomplete.removeEventListener("input", handleInput);
    autocomplete.removeEventListener("change", handleInput);
    autocomplete.removeEventListener("gmp-select", handleSelect);
    autocomplete.remove();
  };
};
