interface FacebookSdk {
  init: (config: {
    appId: string;
    cookie: boolean;
    xfbml: boolean;
    version: string;
  }) => void;
  login: (
    callback: (response: {
      authResponse: {
        accessToken: string;
        userID: string;
        expiresIn: number;
        signedRequest: string;
      } | null;
      status: string;
    }) => void,
    options: { scope: string },
  ) => void;
}

const facebookAppId = import.meta.env.DEV
  ? import.meta.env.VITE_FACEBOOK_APP_ID_DEVELOPMENT ||
    import.meta.env.VITE_FACEBOOK_APP_ID
  : import.meta.env.VITE_FACEBOOK_APP_ID;

declare global {
  interface Window {
    FB: FacebookSdk;
    fbAsyncInit: () => void;
  }
}

export const loadFacebookSDK = () => {
  return new Promise<FacebookSdk>((resolve, reject) => {
    if (!facebookAppId) {
      reject(new Error("Chưa cấu hình Facebook App ID."));
      return;
    }

    if (window.FB) {
      resolve(window.FB);
      return;
    }

    window.fbAsyncInit = function () {
      window.FB.init({
        appId: facebookAppId,

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

    script.onerror = () => {
      reject(new Error("Không thể tải Facebook SDK."));
    };

    document.body.appendChild(script);
  });
};
