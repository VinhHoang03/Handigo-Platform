import { useGoogleLogin } from "@react-oauth/google";
import { useNavigate } from "react-router-dom";
import { loadFacebookSDK } from "@/utils/facebookSdk";
import { useAuth } from "../hooks/useAuth";
import { getRoleHomePath } from "../utils/roleNavigation";

interface Props {
  rememberMe: boolean;
  onError?: (message: string) => void;
}

const facebookAppId = import.meta.env.VITE_FACEBOOK_APP_ID;
const developmentFacebookAppId = import.meta.env.VITE_FACEBOOK_APP_ID_DEVELOPMENT;
const resolvedFacebookAppId = import.meta.env.DEV
  ? developmentFacebookAppId || facebookAppId
  : facebookAppId;
const googleClientId = import.meta.env.DEV
  ? import.meta.env.VITE_GOOGLE_CLIENT_ID_DEVELOPMENT ||
    import.meta.env.VITE_GOOGLE_CLIENT_ID
  : import.meta.env.VITE_GOOGLE_CLIENT_ID;

export default function SocialLoginButtons({ rememberMe, onError }: Props) {
  const { googleLogin, facebookLogin, isLoading } = useAuth();
  const navigate = useNavigate();

  const handleAuthenticatedUser = (
    user: Awaited<ReturnType<typeof googleLogin>>,
  ) => {
    if (user) navigate(getRoleHomePath(user.role), { replace: true });
  };

  const startGoogleLogin = useGoogleLogin({
    flow: "implicit",
    onSuccess: (tokenResponse) => {
      const accessToken = tokenResponse.access_token;
      if (!accessToken) {
        onError?.("Không nhận được thông tin đăng nhập từ Google.");
        return;
      }

      void googleLogin(accessToken, rememberMe, "accessToken")
        .then((user) => {
          if (user) handleAuthenticatedUser(user);
          else onError?.("Đăng nhập Google thất bại.");
        })
        .catch((error: unknown) => {
          onError?.(
            error instanceof Error ? error.message : "Đăng nhập Google thất bại.",
          );
        });
    },
    onError: () => onError?.("Đăng nhập Google thất bại."),
    onNonOAuthError: () =>
      onError?.("Cửa sổ đăng nhập Google đã bị đóng hoặc bị chặn."),
  });

  const handleFacebook = async () => {
    try {
      const facebook = await loadFacebookSDK();
      facebook.login(
        (response) => {
          const accessToken = response.authResponse?.accessToken;
          if (!accessToken) {
            onError?.("Bạn đã hủy đăng nhập Facebook.");
            return;
          }
          void facebookLogin(accessToken, rememberMe)
            .then((user) => {
              if (user) navigate(getRoleHomePath(user.role), { replace: true });
              else onError?.("Đăng nhập Facebook thất bại.");
            })
            .catch((error: unknown) => {
              onError?.(
                error instanceof Error
                  ? error.message
                  : "Đăng nhập Facebook thất bại.",
              );
            });
        },
        { scope: "public_profile,email" },
      );
    } catch {
      onError?.("Không thể khởi tạo đăng nhập Facebook.");
    }
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <button
        type="button"
        disabled={isLoading || !googleClientId}
        onClick={() => startGoogleLogin()}
        className="social-login-button"
      >
        <svg
          className="h-5 w-5 shrink-0"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06L5.84 9.9C6.71 7.31 9.14 5.38 12 5.38z"
          />
        </svg>
        <span>Google</span>
      </button>

      <button
        type="button"
        disabled={isLoading || !resolvedFacebookAppId}
        onClick={handleFacebook}
        className="social-login-button"
      >
        <svg
          aria-hidden="true"
          className="h-5 w-5 shrink-0 fill-[#1877F2]"
          viewBox="0 0 24 24"
        >
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
        <span>Facebook</span>
      </button>
    </div>
  );
}
