import { AuthBrandPanel, AuthLegalLinks, SignInCard } from "../components/auth";
import { MaterialIcon } from "../components/common/MaterialIcon";

const SignInPage = () => (
  <main className="h-screen w-screen flex items-stretch overflow-hidden bg-background">
    <AuthBrandPanel />
    <section className="w-full lg:w-[55%] h-full flex items-center justify-center p-4 md:p-8 relative bg-surface">
      <button
        className="absolute top-4 right-4 p-2 rounded-full bg-surface-container hover:bg-surface-container-high transition-colors text-on-surface-variant"
        aria-label="Đổi giao diện sáng tối"
      >
        <MaterialIcon className="text-xl">dark_mode</MaterialIcon>
      </button>
      <SignInCard />
      <AuthLegalLinks />
    </section>
  </main>
);

export default SignInPage;
