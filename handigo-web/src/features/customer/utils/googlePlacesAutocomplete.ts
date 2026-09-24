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
  types: string[];
}

interface GoogleLatLng {
  lat?: (() => number) | number;
  lng?: (() => number) | number;
}

interface GooglePlace {
  id?: string;
  formattedAddress?: string;
  displayName?: string | { text?: string };
  addressComponents?: GoogleAddressComponent[];
  location?: GoogleLatLng;
  fetchFields?: (options: { fields: string[] }) => Promise<void>;
}

interface PlacePrediction {
  text?: { text?: string } | string;
  structuredFormat?: {
    mainText?: { text?: string };
    secondaryText?: { text?: string };
  };
  toPlace: () => GooglePlace;
}

interface AutocompleteSuggestion {
  placePrediction?: PlacePrediction;
}

interface PlacesLibrary {
  AutocompleteSuggestion?: {
    fetchAutocompleteSuggestions: (request: {
      input: string;
      includedRegionCodes: string[];
      language: string;
      region: string;
      sessionToken?: unknown;
    }) => Promise<{ suggestions: AutocompleteSuggestion[] }>;
  };
  AutocompleteSessionToken?: new () => unknown;
}

interface GeocodingLibrary {
  Geocoder?: new () => {
    geocode: (
      request: { address: string; region: string },
    ) => Promise<{
      results: Array<{
        geometry?: {
          location?: GoogleLatLng;
        };
      }>;
    }>;
  };
}

interface GoogleMapsNamespace {
  maps?: {
    importLibrary?: (
      libraryName: "places" | "geocoding" | "maps",
    ) => Promise<PlacesLibrary | GeocodingLibrary | unknown>;
    Geocoder?: GeocodingLibrary["Geocoder"];
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
  onError?: (message: string) => void;
}

const scriptId = "google-maps-js-sdk";
let mapsApiPromise: Promise<void> | null = null;
let placesLibraryPromise: Promise<PlacesLibrary> | null = null;

const readText = (component: GoogleAddressComponent) =>
  component.longText || component.shortText || "";

const getComponent = (
  components: GoogleAddressComponent[] | undefined,
  acceptedTypes: string[],
) => {
  const component = components?.find((item) =>
    acceptedTypes.some((type) => item.types.includes(type)),
  );
  return component ? readText(component) : "";
};

const readLatLng = (value: GoogleLatLng | undefined) => {
  const latitude = typeof value?.lat === "function" ? value.lat() : value?.lat;
  const longitude = typeof value?.lng === "function" ? value.lng() : value?.lng;
  return { latitude, longitude };
};

const readDisplayName = (value: GooglePlace["displayName"]) =>
  typeof value === "string" ? value : value?.text;

const readPredictionText = (prediction: PlacePrediction) =>
  typeof prediction.text === "string"
    ? prediction.text
    : prediction.text?.text || prediction.structuredFormat?.mainText?.text || "";

export const parseGooglePlace = (place: GooglePlace): ParsedPlaceAddress => {
  const { latitude, longitude } = readLatLng(place.location);
  return {
    fullAddress:
      place.formattedAddress || readDisplayName(place.displayName) || "",
    province: getComponent(place.addressComponents, [
      "administrative_area_level_1",
    ]),
    ward: getComponent(place.addressComponents, [
      "sublocality_level_1",
      "administrative_area_level_3",
      "locality",
    ]),
    latitude,
    longitude,
    placeId: place.id,
  };
};

export const loadGoogleMapsApi = () => {
  if (window.google?.maps?.importLibrary) return Promise.resolve();
  if (mapsApiPromise) return mapsApiPromise;

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return Promise.reject(
      new Error("Chưa cấu hình khóa Google Maps cho ứng dụng."),
    );
  }

  mapsApiPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (existingScript) {
      if (window.google?.maps?.importLibrary) return resolve();
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener(
        "error",
        () => reject(new Error("Không tải được Google Maps.")),
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
      reject(new Error("Không tải được Google Maps."));
    };
    document.head.appendChild(script);
  });

  return mapsApiPromise;
};

export const geocodeSavedAddress = async (fullAddress: string) => {
  await loadGoogleMapsApi();
  const maps = window.google?.maps;
  const geocodingLibrary = (await maps?.importLibrary?.(
    "geocoding",
  )) as GeocodingLibrary | undefined;
  const Geocoder = geocodingLibrary?.Geocoder || maps?.Geocoder;

  if (!Geocoder) {
    throw new Error("Google Maps ch\u01b0a s\u1eb5n s\u00e0ng \u0111\u1ec3 l\u1ea5y t\u1ecda \u0111\u1ed9 \u0111\u1ecba ch\u1ec9.");
  }

  const response = await new Geocoder().geocode({
    address: fullAddress,
    region: "VN",
  });
  const location = response.results[0]?.geometry?.location;
  const coordinates = readLatLng(location);
  if (
    !Number.isFinite(coordinates.latitude) ||
    !Number.isFinite(coordinates.longitude)
  ) {
    throw new Error("Kh\u00f4ng t\u00ecm th\u1ea5y t\u1ecda \u0111\u1ed9 ph\u00f9 h\u1ee3p cho \u0111\u1ecba ch\u1ec9 \u0111\u00e3 l\u01b0u.");
  }

  return {
    latitude: coordinates.latitude!,
    longitude: coordinates.longitude!,
  };
};

export const loadPlacesNewLibrary = async () => {
  if (placesLibraryPromise) return placesLibraryPromise;
  placesLibraryPromise = loadGoogleMapsApi().then(async () => {
    const importLibrary = window.google?.maps?.importLibrary;
    if (!importLibrary) throw new Error("Google Maps chưa sẵn sàng.");
    const library = (await importLibrary("places")) as PlacesLibrary;
    if (!library.AutocompleteSuggestion) {
      throw new Error(
        "Places API (New) chưa được bật hoặc khóa API chưa có quyền sử dụng.",
      );
    }
    return library;
  });
  return placesLibraryPromise;
};

/**
 * Dropdown gợi ý địa chỉ của Google Places được dựng bằng DOM thuần, không qua
 * React, nên không dùng được component của lucide. Hai icon dưới đây là SVG lấy
 * đúng từ lucide (`MapPin`, `LoaderCircle`) để đồng bộ nét vẽ với phần còn lại.
 */
const LUCIDE_SVG_ATTRS =
  'xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';

const MAP_PIN_SVG = (size: number) =>
  `<svg ${LUCIDE_SVG_ATTRS} width="${size}" height="${size}"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>`;

const SPINNER_SVG = (size: number) =>
  `<svg ${LUCIDE_SVG_ATTRS} width="${size}" height="${size}"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`;

export const mountPlaceAutocompleteElement = async ({
  container,
  value = "",
  placeholder = "Nhập số nhà, tên đường",
  onInput,
  onPlaceSelect,
  onError,
}: MountPlaceAutocompleteOptions) => {
  const library = await loadPlacesNewLibrary();
  const suggestionApi = library.AutocompleteSuggestion;
  if (!suggestionApi) throw new Error("Places API (New) chưa sẵn sàng.");

  const wrapper = document.createElement("div");
  wrapper.className = "places-address-field";
  const icon = document.createElement("span");
  icon.className = "places-address-field__icon";
  icon.innerHTML = MAP_PIN_SVG(21);
  const input = document.createElement("input");
  input.id = "address-line-google-places";
  input.className = "google-place-autocomplete places-address-field__input";
  input.type = "text";
  input.autocomplete = "street-address";
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-expanded", "false");
  input.placeholder = placeholder;
  input.value = value;
  const loading = document.createElement("span");
  loading.className = "places-address-field__loading";
  loading.innerHTML = SPINNER_SVG(20);
  loading.hidden = true;
  const dropdown = document.createElement("div");
  dropdown.className = "places-address-dropdown";
  dropdown.setAttribute("role", "listbox");
  dropdown.hidden = true;
  wrapper.append(icon, input, loading, dropdown);
  container.replaceChildren(wrapper);

  let timer: ReturnType<typeof setTimeout> | undefined;
  let requestSequence = 0;
  let activeOptionIndex = -1;
  let sessionToken = library.AutocompleteSessionToken
    ? new library.AutocompleteSessionToken()
    : undefined;

  const closeDropdown = () => {
    activeOptionIndex = -1;
    input.setAttribute("aria-expanded", "false");
    dropdown.hidden = true;
    dropdown.replaceChildren();
  };

  const setActiveOption = (index: number) => {
    const options = Array.from(
      dropdown.querySelectorAll<HTMLButtonElement>(".places-address-option"),
    );
    if (options.length === 0) return;

    activeOptionIndex = (index + options.length) % options.length;
    options.forEach((option, optionIndex) => {
      const isActive = optionIndex === activeOptionIndex;
      option.dataset.active = String(isActive);
      option.setAttribute("aria-selected", String(isActive));
      if (isActive) option.scrollIntoView({ block: "nearest" });
    });
  };

  const selectPrediction = async (prediction: PlacePrediction) => {
    closeDropdown();
    loading.hidden = false;
    try {
      const place = prediction.toPlace();
      await place.fetchFields?.({
        fields: [
          "id",
          "displayName",
          "formattedAddress",
          "location",
          "addressComponents",
        ],
      });
      const parsed = parseGooglePlace(place);
      input.value = parsed.fullAddress || readPredictionText(prediction);
      onInput?.(input.value);
      onPlaceSelect(parsed);
      sessionToken = library.AutocompleteSessionToken
        ? new library.AutocompleteSessionToken()
        : undefined;
    } catch (error) {
      onError?.(
        error instanceof Error
          ? error.message
          : "Không thể lấy thông tin địa điểm đã chọn.",
      );
    } finally {
      loading.hidden = true;
    }
  };

  const renderSuggestions = (suggestions: AutocompleteSuggestion[]) => {
    dropdown.replaceChildren();
    for (const suggestion of suggestions) {
      const prediction = suggestion.placePrediction;
      if (!prediction) continue;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "places-address-option";
      button.setAttribute("role", "option");
      button.setAttribute("aria-selected", "false");
      const optionIcon = document.createElement("span");
      optionIcon.className = "places-address-option__icon";
      optionIcon.innerHTML = MAP_PIN_SVG(20);
      const content = document.createElement("span");
      content.className = "places-address-option__content";
      const main = document.createElement("strong");
      main.textContent =
        prediction.structuredFormat?.mainText?.text || readPredictionText(prediction);
      const secondary = document.createElement("small");
      secondary.textContent = prediction.structuredFormat?.secondaryText?.text || "";
      content.append(main, secondary);
      button.append(optionIcon, content);
      button.addEventListener("mousedown", (event) => event.preventDefault());
      button.addEventListener("click", () => void selectPrediction(prediction));
      dropdown.appendChild(button);
    }
    dropdown.hidden = dropdown.childElementCount === 0;
    input.setAttribute("aria-expanded", String(!dropdown.hidden));
    activeOptionIndex = -1;
  };

  const fetchSuggestions = async () => {
    const inputValue = input.value.trim();
    const currentSequence = ++requestSequence;
    if (inputValue.length < 2) return closeDropdown();
    loading.hidden = false;
    try {
      const response = await suggestionApi.fetchAutocompleteSuggestions({
        input: inputValue,
        includedRegionCodes: ["vn"],
        language: "vi",
        region: "vn",
        sessionToken,
      });
      if (currentSequence === requestSequence) {
        renderSuggestions(response.suggestions);
      }
    } catch (error) {
      if (currentSequence === requestSequence) closeDropdown();
      console.error("Không thể tải gợi ý địa chỉ từ Places New.", error);
      onError?.(
        "Không tải được gợi ý địa chỉ. Hãy kiểm tra Places API (New), thanh toán và quyền của khóa Google Maps.",
      );
    } finally {
      if (currentSequence === requestSequence) loading.hidden = true;
    }
  };

  const handleInput = () => {
    onInput?.(input.value);
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void fetchSuggestions(), 280);
  };
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      closeDropdown();
      return;
    }

    if (dropdown.hidden) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveOption(activeOptionIndex + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveOption(activeOptionIndex - 1);
    } else if (event.key === "Enter" && activeOptionIndex >= 0) {
      event.preventDefault();
      const activeOption = dropdown.querySelectorAll<HTMLButtonElement>(
        ".places-address-option",
      )[activeOptionIndex];
      activeOption?.click();
    }
  };
  const handleBlur = () => setTimeout(closeDropdown, 150);

  input.addEventListener("input", handleInput);
  input.addEventListener("keydown", handleKeyDown);
  input.addEventListener("blur", handleBlur);

  return () => {
    requestSequence += 1;
    if (timer) clearTimeout(timer);
    input.removeEventListener("input", handleInput);
    input.removeEventListener("keydown", handleKeyDown);
    input.removeEventListener("blur", handleBlur);
    wrapper.remove();
  };
};
