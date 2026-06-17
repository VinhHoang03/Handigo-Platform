import nodemailer from "nodemailer";

const getTransporter = () => {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASSWORD;

  if (!user || !pass) {
    throw new Error("EMAIL_USER and EMAIL_PASSWORD must be defined");
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user,
      pass,
    },
  });
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
