import {
  InfoField,
  ProfileSection,
  SkillTags,
} from "../ProviderProfileComponents";

export function ProfessionalSummarySection({
  bio,
  experience,
  skills,
  onEdit,
  onRequestServiceAddition,
}: {
  bio: string;
  experience: string;
  skills: string[];
  onEdit: () => void;
  onRequestServiceAddition: () => void;
}) {
  return (
    <ProfileSection
      title="Thông tin nghề nghiệp"
      actions={
        <div className="flex flex-wrap items-center justify-end gap-sm">
          <button
            type="button"
            className="btn-secondary min-h-11 min-w-[188px] px-4 py-2 text-sm border-outline-variant/60 bg-surface-container-lowest text-center shadow-[0_4px_20px_rgba(19,27,46,0.05)] hover:border-primary/35"
            onClick={onEdit}
          >
            Chỉnh sửa nghề nghiệp
          </button>
          <div className="group relative">
            <button
              type="button"
              className="btn-primary min-h-11 min-w-[188px] px-4 py-2 text-sm"
              onClick={onRequestServiceAddition}
              aria-describedby="service-addition-tooltip"
            >
              Đăng ký thêm dịch vụ
            </button>
            <div
              id="service-addition-tooltip"
              role="tooltip"
              className="pointer-events-none absolute right-0 top-full z-20 mt-3 w-72 translate-y-1 rounded-xl bg-on-surface px-4 py-3 text-sm leading-6 text-surface opacity-0 shadow-lg transition-all duration-200 group-group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100"
            >
              Muốn nhận thêm loại dịch vụ mới, bạn cần gửi chứng chỉ để admin
              xét duyệt.
              <span className="absolute -top-2 right-6 h-4 w-4 rotate-45 rounded-[2px] bg-on-surface" />
            </div>
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        <InfoField
          label="Giới thiệu chuyên môn"
          value={
            <p className="leading-relaxed text-on-surface-variant">{bio}</p>
          }
        />
        <InfoField label="Kinh nghiệm" value={experience} />
        <InfoField label="Các dịch vụ" value={<SkillTags skills={skills} />} />
      </div>
    </ProfileSection>
  );
}
