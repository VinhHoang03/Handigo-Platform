import nodemailer from "nodemailer";

const getTransporter = (notification = false) => {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASSWORD;

  if (!user || !pass) {
    throw new Error("Phải cấu hình EMAIL_USER và EMAIL_PASSWORD");
  }

  return nodemailer.createTransport({
    service: "gmail",
    ...(notification ? { connectionTimeout: 15_000, greetingTimeout: 15_000, socketTimeout: 30_000 } : {}),
    auth: {
      user,
      pass,
    },
  });
};

export const sendNotificationEmail = async (message: {
  to: string; subject: string; text: string; html: string; messageId: string;
}): Promise<void> => {
  const result = await getTransporter(true).sendMail({
    ...message,
    from: { name: "Handigo", address: process.env.EMAIL_USER! },
  });
  if (!result.accepted?.length || result.rejected?.length) {
    throw new Error("Máy chủ email chưa chấp nhận thông báo vi phạm.");
  }
};

export const sendOtpEmail = async (
  to: string,
  subject: string,
  otp: string,
): Promise<void> => {
  const transporter = getTransporter();

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to,
    subject,
    text: `Your OTP is ${otp}. It will expire in 10 minutes.`,
    html: `<p>Your OTP is <strong>${otp}</strong>.</p><p>It will expire in 10 minutes.</p>`,
  });
};
