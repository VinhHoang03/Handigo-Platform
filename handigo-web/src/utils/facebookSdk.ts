interface FacebookSdk {
  init: (config: {
    appId: string;
    cookie: boolean;
    xfbml: boolean;
    version: string;
  }) => void;
}

declare global {
  interface Window {
    FB: FacebookSdk;
    fbAsyncInit: () => void;
  }
}

export const loadFacebookSDK = () => {
  return new Promise<FacebookSdk>((resolve) => {
    if (window.FB) {
      resolve(window.FB);
      return;
    }

    window.fbAsyncInit = function () {
      window.FB.init({
        appId: import.meta.env.VITE_FACEBOOK_APP_ID,

        cookie: true,

        xfbml: true,

        version: "v19.0",
      });

      resolve(window.FB);
    };

    const script = document.createElement("script");

    script.src = "https://connect.facebook.net/en_US/sdk.js";

    script.async = true;

    script.defer = true;

    document.body.appendChild(script);
  });
};
