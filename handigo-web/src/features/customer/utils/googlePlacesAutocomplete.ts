export interface ParsedPlaceAddress {
  fullAddress: string;
  province: string;
  ward: string;
  latitude?: number;
  longitude?: number;
  placeId?: string;
}

interface GoogleAddressComponent {
  long_name: string;
  short_name: string;
  types: string[];
}

interface GooglePlace {
  formatted_address?: string;
  name?: string;
  place_id?: string;
  address_components?: GoogleAddressComponent[];
  geometry?: {
    location?: {
      lat: () => number;
      lng: () => number;
    };
  };
}

interface GoogleAutocompleteOptions {
  componentRestrictions?: { country: string | string[] };
  fields?: string[];
}

interface GoogleAutocompleteListener {
  remove: () => void;
}

interface GoogleAutocomplete {
  addListener: (eventName: string, handler: () => void) => GoogleAutocompleteListener;
  getPlace: () => GooglePlace;
}

interface GoogleMapsNamespace {
  maps?: {
    places?: {
      Autocomplete: new (
        input: HTMLInputElement,
        options: GoogleAutocompleteOptions,
      ) => GoogleAutocomplete;
    };
    event?: {
      clearInstanceListeners: (instance: unknown) => void;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleMapsNamespace;
  }
}

const scriptId = 'google-maps-places-sdk';
let placesApiPromise: Promise<void> | null = null;

const getComponent = (
  components: GoogleAddressComponent[] | undefined,
  acceptedTypes: string[],
) => components?.find((component) => acceptedTypes.some((type) => component.types.includes(type)))?.long_name || '';

export const parseGooglePlace = (place: GooglePlace): ParsedPlaceAddress => {
  const components = place.address_components;
  const location = place.geometry?.location;

  return {
    fullAddress: place.formatted_address || place.name || '',
    province: getComponent(components, ['administrative_area_level_1']),
    ward: getComponent(components, [
      'sublocality_level_1',
      'administrative_area_level_3',
      'locality',
    ]),
    latitude: location?.lat(),
    longitude: location?.lng(),
    placeId: place.place_id,
  };
};

export const loadGooglePlacesApi = () => {
  if (window.google?.maps?.places) return Promise.resolve();
  if (placesApiPromise) return placesApiPromise;

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return Promise.reject(new Error('Missing VITE_GOOGLE_MAPS_API_KEY'));
  }

  placesApiPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(), { once: true });
      existingScript.addEventListener('error', () => reject(new Error('Google Maps script failed to load')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&language=vi&region=VN`;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Google Maps script failed to load'));
    document.head.appendChild(script);
  });

  return placesApiPromise;
};

export const attachPlacesAutocomplete = async (
  input: HTMLInputElement,
  onPlaceSelect: (address: ParsedPlaceAddress) => void,
) => {
  await loadGooglePlacesApi();
  const Autocomplete = window.google?.maps?.places?.Autocomplete;
  if (!Autocomplete) throw new Error('Google Places Autocomplete is unavailable');

  const autocomplete = new Autocomplete(input, {
    componentRestrictions: { country: 'vn' },
    fields: ['formatted_address', 'address_components', 'geometry', 'place_id', 'name'],
  });

  const listener = autocomplete.addListener('place_changed', () => {
    onPlaceSelect(parseGooglePlace(autocomplete.getPlace()));
  });

  return () => {
    listener.remove();
    window.google?.maps?.event?.clearInstanceListeners(autocomplete);
  };
};
