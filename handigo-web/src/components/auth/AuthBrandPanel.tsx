import { BrandLogo } from '../common/BrandLogo';

const authImage = 'https://lh3.googleusercontent.com/aida-public/AB6AXuD0cQKX_cmLv7f0FxiTLGxAy9rT77Rl0Udh26-uPOKXjk3RCcqglDLDzSOMXx2QBy-IqL49LLKsCjXw_Mmu4i93C0xD62JaIuERVnSG8NySmmJ8LVadtNnU-8poP-Mhh83xuX6Xyw-onspaJqMAvGaoJFgM2zVZ9ZzM0ifyOmn15g58UEt8UJZJc-ZzeMFGqKi7RQHcHxLxTKXrZQk8nzAYcqrn9nPz77k0_bgntw_hhtME036p6yhPWATWJ92Gdf59R2IpAOVrup4';

export const AuthBrandPanel = () => (
  <section className="hidden lg:flex w-[45%] h-full relative flex-col items-center justify-center overflow-hidden bg-primary p-8">
    <div className="absolute inset-0 z-0 pointer-events-none">
      <div className="absolute top-[-10%] right-[-10%] w-[400px] h-[400px] bg-secondary-container/20 rounded-full blur-[80px]" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[350px] h-[350px] bg-inverse-primary/20 rounded-full blur-[70px]" />
    </div>
    <div className="relative z-10 flex flex-col items-center text-center max-w-[400px]">
      <BrandLogo className="mb-2 [&_span]:text-white" />
      <h1 className="text-2xl xl:text-3xl font-bold text-white mb-4 leading-tight">
        Chuyên gia đáng tin cậy cho <span className="text-secondary-fixed">dịch vụ tại nhà.</span>
      </h1>
      <p className="text-sm xl:text-base text-on-primary-container/80 mb-8">
        Kết nối bạn với những chuyên gia hàng đầu cho mọi nhu cầu sửa chữa và bảo trì tổ ấm.
      </p>
      <div className="relative w-full max-w-[320px] aspect-square rounded-2xl overflow-hidden shadow-2xl group">
        <img className="w-full h-full object-cover transform transition-transform duration-700 group-hover:scale-105" src={authImage} alt="Minh họa bảo trì nhà cửa" />
        <div className="absolute inset-0 bg-gradient-to-t from-primary/40 to-transparent" />
      </div>
    </div>
  </section>
);
