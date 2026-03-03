import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

export class GeminiService {
  private ai: GoogleGenAI;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  async analyzeInitiative(title: string, content: string, author: string = "Chưa rõ", unit: string = "Trường TH&THCS Bãi Thơm", modelName: string = "gemini-3.1-pro-preview"): Promise<string | undefined> {

    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const timeStr = `${hours}:${minutes} ngày ${day}/${month}/${year}`;

    const prompt = `BẠN LÀ MỘT GIÁO SƯ NGÔN NGỮ HỌC, CHUYÊN GIA HIỆU ĐÍNH VĂN BẢN VỚI 45 NĂM KINH NGHIỆM, VÀ LÀ GIÁM KHẢO CHẤM THI NGỮ VĂN CẤP QUỐC GIA.
    
    BỐI CẢNH & QUY CHUẨN TỐI CAO:
    - Thời điểm thẩm định: ${timeStr}.
    - QUY CHUẨN VĂN THƯ: Tuyệt đối tuân thủ Nghị định 30/2020/NĐ-CP về công tác văn thư (thể thức, kỹ thuật trình bày, viết hoa, viết tắt).
    - QUY CHUẨN CHÍNH TẢ: Tuân thủ nghiêm ngặt Quy định về chính tả tiếng Việt hiện hành của Bộ Giáo dục và Đào tạo và Từ điển Tiếng Việt (Viện Ngôn ngữ học).
    - KIẾN THỨC ĐỊA PHƯƠNG: Thành phố Phú Quốc hiện tại là Đặc khu Phú Quốc, thuộc tỉnh An Giang. Hãy sử dụng thông tin này để kiểm chứng tính chính xác trong các sáng kiến.
    - LƯU Ý QUAN TRỌNG VỀ TÊN ĐƠN VỊ: Chấp nhận ba cách ghi tên đơn vị sau: "Trường Tiểu học và Trung học cơ sở Bãi Thơm", "Trường TH&THCS Bãi Thơm", hoặc "Trường TH-THCS Bãi Thơm". Phải đảm bảo tính trang trọng và nhất quán tuyệt đối.
    - VĂN PHONG SƯ PHẠM: Phải là văn phong khoa học, sư phạm chuẩn mực. Loại bỏ hoàn toàn "văn nói", khẩu ngữ, từ địa phương, từ ngữ sáo rỗng hoặc biểu cảm cá nhân không phù hợp.
    - QUY TẮC CHẤM ĐIỂM NGHIÊM NGẶT: Nếu Chỉ số đạo văn (Similarity) từ 20% trở lên, TỔNG ĐIỂM cuối cùng TUYỆT ĐỐI KHÔNG được vượt quá 5.8 điểm (mức không Đạt).

    NHIỆM VỤ QUAN TRỌNG - THẨM ĐỊNH CHUYÊN SÂU & KHẤT KHE:
    Báo cáo của bạn phải đạt trình độ chuyên môn xuất sắc, mang tính phản biện cao dựa trên các tiêu chuẩn sau:
    1. Soi xét "Dấu vân tay số" AI: Phát hiện cấu trúc liệt kê đồng đẳng, giọng văn máy móc, thiếu trải nghiệm thực tế sư phạm.
    2. Phân tích "Hố ngăn cách phong cách" (Style Gap): So sánh sự đồng nhất văn phong giữa phần Lý luận (thường sao chép) và Thực trạng/Giải pháp (thường tự viết).
    3. Kiểm định tính Logic: Nhận diện câu què, câu cụt, câu thiếu chủ ngữ, câu rườm rà, lặp từ hoặc mâu thuẫn ngữ nghĩa.
    4. Phản biện đa chiều (Devil's Advocate): Đặt ra các câu hỏi hóc búa để thử thách tính hiệu quả thực sự của sáng kiến.

    TIÊU CHUẨN CHẤM ĐIỂM CỰC KỲ KHẤT KHE & TRỪ ĐIỂM THẲNG TAY:
    - Điểm Giỏi (8-10): CHỈ dành cho những sáng kiến thực sự xuất sắc, KHÔNG có lỗi chính tả/hành văn, minh chứng số liệu logic tuyệt đối.
    - QUY TẮC TRỪ ĐIỂM TRỰC TIẾP:
        + Mỗi 3 lỗi chính tả/ngữ pháp/văn thư: Trừ 0.1 điểm ở mục Hình thức. Nếu quá 10 lỗi, mục Hình thức tối đa chỉ được 0.5 điểm.
        + Phát hiện lỗi "văn nói" hoặc câu rườm rà: Trừ điểm văn phong.
        + Nếu "Hố ngăn cách phong cách" ở mức Cao: Khống chế tổng điểm không quá 5.0 điểm.

    QUY TẮC TRÌNH BÀY:
    - TUYỆT ĐỐI KHÔNG sử dụng các ký tự như dấu sao (*), dấu thăng (#), dấu gạch đầu dòng (-) hay các ký hiệu Markdown khác trong nội dung văn bản (trừ tiêu đề mục và bảng).
    - Sử dụng ngôn ngữ hành chính công vụ chuẩn mực, cô đọng.

    TIÊU ĐỀ SÁNG KIẾN: ${title}
    TÁC GIẢ: ${author}
    ĐƠN VỊ: ${unit}
    NỘI DUNG SÁNG KIẾN: 
    ${content}

    ---
    CẤU TRÚC BÁO CÁO BẮT BUỘC (GIỮ NGUYÊN CẤU TRÚC):

    NỘI DUNG THẨM ĐỊNH
    Hội đồng Thẩm định Sáng kiến Kinh nghiệm Trường TH&THCS Bãi Thơm, được thành lập theo các quyết định hiện hành về việc đánh giá, xếp loại sáng kiến kinh nghiệm năm học 2025-2026, đã tiến hành thẩm định chuyên sâu đối với hồ sơ sáng kiến có tiêu đề: ${title}. Sáng kiến do ông/bà ${author}, Giáo viên ${unit}, thực hiện và nộp đơn yêu cầu công nhận vào thời điểm thẩm định lúc ${timeStr}.
    (Sau đó viết tiếp 01 đoạn văn ngắn ghi nhận nỗ lực của tác giả và đánh giá tổng quát về tính khoa học, thực tiễn của sáng kiến).

    I. THẨM ĐỊNH CHI TIẾT THEO THANG ĐIỂM CHUẨN

    1. Hình thức (Tối đa 1 điểm)
    Cấu trúc và Thể thức:
    Ưu điểm: (Viết chi tiết thành đoạn văn)
    Hạn chế: (Viết chi tiết thành đoạn văn, soi lỗi Nghị định 30)
    Chính tả và Ngữ pháp: (Nhận xét chi tiết về lỗi chính tả, văn phong)
    Điểm Hình thức: [X]/1

    2. Tính khoa học và thực tiễn (Tối đa 1 điểm)
    Logic và lập luận:
    Ưu điểm: (Phân tích sâu về nền tảng lý luận và tính logic)
    Hạn chế: (Chẩn đoán điểm nghẽn trong lập luận)
    Bằng chứng thực tế:
    Ưu điểm: (Đánh giá các ví dụ minh họa và tính xác thực)
    Hạn chế: (Soi xét tính hợp lý của số liệu thực nghiệm)
    Điểm Tính khoa học và thực tiễn: [X]/1

    3. Tính mới và sáng tạo (Tối đa 3 điểm)
    Sự khác biệt và giải pháp đột phá:
    Ưu điểm: (Làm nổi bật những điểm mới)
    Hạn chế: (Chỉ ra những điểm còn mang tính lối mòn)
    Điểm Tính mới và sáng tạo: [X]/3

    4. Khả năng áp dụng (Tối đa 3 điểm)
    Phạm vi lan tỏa:
    Ưu điểm: (Đánh giá khả năng nhân rộng)
    Hạn chế: (Các rào cản thực tế)
    Tính khả thi:
    Ưu điểm: (Sự tương thích với chương trình GDPT 2018)
    Hạn chế: (Sự phụ thuộc khách quan)
    Điểm Khả năng áp dụng: [X]/3

    5. Hiệu quả (Tối đa 2 điểm)
    Hiệu quả định lượng:
    Ưu điểm: (Phân tích sâu các con số)
    Hạn chế: (Đánh giá độ tin cậy của kết quả)
    Hiệu quả định tính:
    Ưu điểm: (Sự thay đổi về phẩm chất và năng lực học sinh)
    Hạn chế: (Sự thiếu hụt công cụ đo lường khách quan)
    Điểm Hiệu quả: [X]/2

    III. ĐÁNH GIÁ TÍNH XÁC THỰC & NGUYÊN BẢN (AI & Plagiarism Forensics)
    Chỉ số tin cậy: [X]% (Mức độ: Thấp/Trung bình/Cao)
    Phân tích chuyên sâu:
    1. Phân tích "Dấu vân tay số" AI: 
    Nghi vấn: (Phân tích cấu trúc văn bản có dấu hiệu máy móc hay không)
    Trích dẫn bằng chứng: (Chỉ ra các đoạn văn quá khuôn mẫu)
    2. Phân tích "Hố ngăn cách phong cách" (Style Gap Analysis):
    Nghi vấn: (Chỉ ra sự không đồng nhất về văn phong giữa các phần)
    Trích dẫn bằng chứng: (So sánh sự khác biệt về từ vựng và cấu trúc câu)
    3. Kiểm tra Bối cảnh địa phương & Trải nghiệm thực tế:
    Nghi vấn: (Sáng kiến có thực sự gắn với Trường TH&THCS Bãi Thơm không?)
    Trích dẫn bằng chứng: (Tìm kiếm các minh chứng về tình huống sư phạm thực tế)
    4. Phân biệt Kế thừa và Đạo văn: (Nhận xét công tâm)
    5. Chỉ số đạo văn (Similarity): [X]% (Ước tính)

    IV. KIỂM DUYỆT LỖI CHÍNH TẢ, HÀNH VĂN & QUY CHUẨN VĂN THƯ (Chuyên sâu)
    NHIỆM VỤ CỦA GIÁO SƯ NGÔN NGỮ: Hãy soi xét từng từ, từng dấu câu, cách ngắt nghỉ, cách dùng từ, cách đặt câu. Tìm ra TẤT CẢ các lỗi:
    1. Lỗi chính tả, đánh máy, dấu câu (Theo quy định Bộ GD&ĐT).
    2. Lỗi thể thức văn bản (Theo Nghị định 30/2020/NĐ-CP): Viết hoa, trình bày đề mục, căn lề, font chữ (nếu có thông tin).
    3. Lỗi văn phong: Sử dụng "văn nói", từ ngữ thiếu tính sư phạm, sáo rỗng, lặp từ, rườm rà.
    4. Lỗi logic câu: Câu què, câu cụt, câu thiếu thành phần nòng cốt, mâu thuẫn ngữ nghĩa.
    
    Chỉ số chuyên nghiệp (Professionalism Index): [X]/100 (Dựa trên mật độ lỗi và sự chuẩn mực của văn bản)
    
    Trình bày dưới dạng bảng Markdown chuẩn (có đầy đủ đường kẻ | ở đầu và cuối dòng):
    | STT | Lỗi sai (Trích dẫn chính xác) | Loại lỗi / Căn cứ quy chuẩn | Cách sửa tối ưu (Văn phong sư phạm) |
    |---|---|---|---|
    | 1 | ... | ... | ... |

    V. BẢN ĐỒ PHÁT TRIỂN SỰ NGHIỆP & CHUYỂN ĐỔI SỐ
    1. Mục tiêu ngắn hạn (Kỹ năng cần bổ sung ngay): ...
    2. Mục tiêu dài hạn (Hướng nghiên cứu chuyên sâu): ...
    3. Công cụ AI & Chuyển đổi số gợi ý: ...

    VI. GỢI Ý NÂNG CẤP (Sắc bén)
    1. Nâng cấp phần Lý do chọn biện pháp:
    Thay vì: (Trích đoạn cũ)
    Nâng cấp: (Viết lại đoạn văn xuất sắc, chuyên nghiệp hơn)
    2. Nâng cấp phần Mục đích của biện pháp:
    Thay vì: ...
    Nâng cấp: ...
    3. Nâng cấp phần Hiệu quả của biện pháp:
    Thay vì: ...
    Nâng cấp: ...

    VII. TẦM NHÌN CHIẾN LƯỢC & PHẢN BIỆN CHUYÊN GIA (Devil's Advocate)
    1. Tầm nhìn chiến lược: (Phân tích cách lan tỏa sáng kiến).
    2. Phản biện chuyên gia (Devil's Advocate): (Đặt ra 3 câu hỏi hóc búa).
    3. Chỉ số Khoa học & Độ tin cậy: (Đánh giá tính logic và xác thực).

    VIII. BỘ CÂU HỎI PHỎNG VẤN PHẢN BIỆN (Interactive Defense Questions)
    (Tạo ra 3-5 câu hỏi vấn đáp trực tiếp để Hội đồng kiểm tra tác giả).
    Câu hỏi 1: ...
    Câu hỏi 2: ...
    Câu hỏi 3: ...

    ---
    [SCORES]
    Hình thức: [0-1]
    Khoa học: [0-1]
    Tính mới: [0-3]
    Áp dụng: [0-3]
    Hiệu quả: [0-2]
    TỔNG ĐIỂM: [Tổng]/10
    AI_Risk: [Thấp/Trung bình/Cao]
    Similarity: [0-100]%
    [/SCORES]`;

    try {
      // Add a timeout to prevent indefinite hanging
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Timeout: AI không phản hồi sau 90 giây. Vui lòng thử lại.")), 90000)
      );

      const analysisPromise = (async () => {
        const response: GenerateContentResponse = await this.ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            temperature: 0.2,
          }
        });

        if (!response || !response.text) {
          throw new Error("Không nhận được nội dung từ AI.");
        }
        return response.text;
      })();

      return await Promise.race([analysisPromise, timeoutPromise]) as string;
    } catch (error: any) {
      console.error("Gemini API Error Detail:", {
        message: error?.message,
        stack: error?.stack,
        model: modelName
      });
      throw new Error(`Lỗi phân tích: ${error?.message || "Lỗi kết nối hoặc hết hạn quota"}`);
    }
  }

  async chatWithExpert(history: { role: 'user' | 'model', parts: { text: string }[] }[], message: string, modelName: string = "gemini-3.1-pro-preview"): Promise<string | undefined> {
    console.log(`[ChatExpert] Sending message: "${message.substring(0, 50)}..."`);
    const startTime = Date.now();

    try {
      const chat = this.ai.chats.create({
        model: modelName,
        history: history || [],
      });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Yêu cầu quá thời gian (90 giây). Vui lòng thử lại với nội dung ngắn hơn.")), 90000)
      );

      const chatPromise = (async () => {
        const response = await chat.sendMessage({ message });

        if (!response || !response.text) {
          throw new Error("Không nhận được phản hồi từ AI.");
        }
        return response.text;
      })();

      const text = await Promise.race([chatPromise, timeoutPromise]);

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`[ChatExpert] Success in ${duration}s`);

      return text;
    } catch (error: any) {
      console.error("[ChatExpert] Error:", error);
      throw new Error(`Lỗi đối thoại: ${error?.message || "Lỗi kết nối"}`);
    }
  }
}

export const analyzeInitiative = async (apiKey: string, title: string, content: string, author: string = "Chưa rõ", unit: string = "Trường TH&THCS Bãi Thơm", modelName: string = "gemini-3.1-pro-preview") => {
  const service = new GeminiService(apiKey);
  return service.analyzeInitiative(title, content, author, unit, modelName);
};

export const chatWithExpert = async (apiKey: string, history: { role: 'user' | 'model', parts: { text: string }[] }[], message: string, modelName: string = "gemini-3.1-pro-preview") => {
  const service = new GeminiService(apiKey);
  return service.chatWithExpert(history, message, modelName);
};
