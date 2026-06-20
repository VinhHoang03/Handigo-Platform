import "dotenv/config";
import { existsSync } from "fs";
import path from "path";
import vision from "@google-cloud/vision";

const resolveFromCurrentDirectory = (filePath: string) =>
  path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);

const testGoogleVisionOcr = async () => {
  const credentialPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const imageArgument = process.argv[2];

  if (!credentialPath) {
    throw new Error("Thiếu biến môi trường GOOGLE_APPLICATION_CREDENTIALS");
  }

  const absoluteCredentialPath = resolveFromCurrentDirectory(credentialPath);
  if (!existsSync(absoluteCredentialPath)) {
    throw new Error(
      `Không tìm thấy file Service Account: ${absoluteCredentialPath}`,
    );
  }

  if (!imageArgument) {
    throw new Error(
      "Thiếu đường dẫn ảnh. Ví dụ: npm run ocr:test -- ./test-data/ocr-sample.jpg",
    );
  }

  const absoluteImagePath = resolveFromCurrentDirectory(imageArgument);
  if (!existsSync(absoluteImagePath)) {
    throw new Error(`Không tìm thấy ảnh test: ${absoluteImagePath}`);
  }

  // Không truyền keyFilename: Google Auth Library tự đọc nguồn ADC từ biến môi trường.
  const client = new vision.ImageAnnotatorClient();

  try {
    const projectId = await client.auth.getProjectId();
    console.log(`Đã đọc credential ADC cho project: ${projectId}`);

    const [result] = await client.textDetection(absoluteImagePath);
    const text = result.textAnnotations?.[0]?.description?.trim() || "";

    console.log("Đã gọi Google Cloud Vision API thành công.");
    console.log("Kết quả OCR:");
    console.log(text || "Không nhận diện được văn bản trong ảnh.");
  } finally {
    await client.close();
  }
};

testGoogleVisionOcr().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Lỗi không xác định";
  console.error(`Kiểm tra Google Vision OCR thất bại: ${message}`);
  process.exit(1);
});
