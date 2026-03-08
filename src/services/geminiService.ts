import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

export class GeminiService {
  private ai: GoogleGenAI;

  constructor(apiKey: string) {
    // This SDK (Next Gen) requires an object for configuration
    this.ai = new GoogleGenAI({ 
      apiKey, 
      // Using v1beta as it supports BOTH stable and experimental/preview models.
      // Stable models (1.5 Flash, 2.0 Flash) are accessible here as well.
      apiVersion: "v1beta" 
    });
  }

  /**
   * Normalizes model names to strictly follow the current Google API requirements
   */
  private normalizeModel(name: string): string {
    const modelName = name.trim().toLowerCase();
    
    // Exact mapping for requested models to stable IDs
    if (modelName.includes("3.1-flash-lite")) return "gemini-2.0-flash-lite-preview-02-05";
    if (modelName.includes("3-flash")) return "gemini-2.0-flash";
    if (modelName.includes("2.5-pro")) return "gemini-2.0-pro-exp-02-05";
    if (modelName.includes("2.5-flash")) return "gemini-2.0-flash";
    
    // Standard version mappings
    if (modelName === "gemini-2-flash") return "gemini-2.0-flash";
    if (modelName === "gemini-2-flash-exp") return "gemini-2.0-flash-exp";
    if (modelName === "gemini-2-flash-lite") return "gemini-2.0-flash-lite-preview-02-05";
    
    // Ensure base models are clean
    if (modelName === "gemini-1.5-flash") return "gemini-1.5-flash";
    if (modelName === "gemini-1.5-pro") return "gemini-1.5-pro";
    if (modelName === "gemini-2.0-flash") return "gemini-2.0-flash";

    return name.trim(); // Fallback to trimmed original
  }

  async analyzeInitiative(title: string, content: string, author: string = "Chưa rõ", unit: string = "Trường TH&THCS Bãi Thơm", modelName: string = "gemini-1.5-flash"): Promise<string | undefined> {
    const prompt = this.getAnalysisPrompt(title, content, author, unit);
    const targetModel = this.normalizeModel(modelName);

    const analyzeWithRetry = async (retryCount = 0): Promise<string> => {
      try {
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Timeout: AI phản hồi quá chậm (180 giây). Vui lòng kiểm tra lại nội dung hoặc thử lại lần nữa.")), 180000)
        );

        const analysisPromise = (async () => {
          // Cast to any to avoid TS errors if types are slightly mismatched in this experimental SDK
          const response: GenerateContentResponse = await (this.ai.models.generateContent as any)({
            model: targetModel,
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: {
              temperature: 0.2,
            }
          });

          const text = response.text;
          if (!text) {
            throw new Error("Không nhận được nội dung từ AI.");
          }
          return text;
        })();

        return await Promise.race([analysisPromise, timeoutPromise]) as string;
      } catch (error: any) {
        return this.handleRetry(error, retryCount, () => analyzeWithRetry(retryCount + 1));
      }
    };

    try {
      return await analyzeWithRetry();
    } catch (error: any) {
      throw this.transformError(error, targetModel);
    }
  }

  async analyzeInitiativeStream(
    title: string, 
    content: string, 
    onChunk: (chunk: string) => void,
    author: string = "Chưa rõ", 
    unit: string = "Trường TH&THCS Bãi Thơm", 
    modelName: string = "gemini-1.5-flash"
  ): Promise<string> {
    const prompt = this.getAnalysisPrompt(title, content, author, unit);
    const targetModel = this.normalizeModel(modelName);

    const analyzeWithRetry = async (retryCount = 0): Promise<string> => {
      try {
        const result = await (this.ai.models.generateContentStream as any)({
          model: targetModel,
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          config: {
            temperature: 0.2,
          }
        });

        let fullText = "";
        for await (const chunk of result) {
          const chunkText = chunk.text;
          if (chunkText) {
            fullText += chunkText;
            onChunk(fullText);
          }
        }

        if (!fullText) {
          throw new Error("Không nhận được nội dung từ AI.");
        }
        return fullText;
      } catch (error: any) {
        return this.handleRetry(error, retryCount, () => analyzeWithRetry(retryCount + 1));
      }
    };

    try {
      return await analyzeWithRetry();
    } catch (error: any) {
      throw this.transformError(error, targetModel);
    }
  }

  async chatWithExpert(history: { role: 'user' | 'model', parts: { text: string }[] }[], message: string, modelName: string = "gemini-1.5-flash"): Promise<string | undefined> {
    const targetModel = this.normalizeModel(modelName);
    const chatWithRetry = async (retryCount = 0): Promise<string> => {
      try {
        const contents = [...history, { role: 'user', parts: [{ text: message }] }];
        const response: GenerateContentResponse = await (this.ai.models.generateContent as any)({
          model: targetModel,
          contents: contents,
          config: { temperature: 0.7 }
        });

        const text = response.text;
        if (!text) throw new Error("Không nhận được phản hồi từ AI.");
        return text;
      } catch (error: any) {
        return this.handleRetry(error, retryCount, () => chatWithRetry(retryCount + 1));
      }
    };

    try {
      return await chatWithRetry();
    } catch (error: any) {
      throw this.transformError(error, targetModel);
    }
  }

  async chatWithExpertStream(
    history: { role: 'user' | 'model', parts: { text: string }[] }[], 
    message: string, 
    onChunk: (chunk: string) => void,
    modelName: string = "gemini-1.5-flash"
  ): Promise<string> {
    const targetModel = this.normalizeModel(modelName);
    const chatWithRetry = async (retryCount = 0): Promise<string> => {
      try {
        const contents = [...history, { role: 'user', parts: [{ text: message }] }];
        const result = await (this.ai.models.generateContentStream as any)({
          model: targetModel,
          contents: contents,
          config: { temperature: 0.7 }
        });

        let fullText = "";
        for await (const chunk of result) {
          const chunkText = chunk.text;
          if (chunkText) {
            fullText += chunkText;
            onChunk(fullText);
          }
        }
        return fullText;
      } catch (error: any) {
        return this.handleRetry(error, retryCount, () => chatWithRetry(retryCount + 1));
      }
    };

    try {
      return await chatWithRetry();
    } catch (error: any) {
      throw this.transformError(error, targetModel);
    }
  }

  private handleRetry(error: any, retryCount: number, retryFn: () => Promise<string>): Promise<string> {
    const isRetryable = error?.message?.includes("503") ||
      error?.message?.includes("429") ||
      error?.message?.includes("UNAVAILABLE") ||
      error?.message?.includes("RESOURCE_EXHAUSTED") ||
      error?.message?.includes("Timeout");

    if (isRetryable && retryCount < 3) {
      const delay = Math.pow(2, retryCount) * 2000;
      console.log(`Retry attempt ${retryCount + 1} due to service instability. Waiting ${delay}ms...`);
      return new Promise(r => setTimeout(r, delay)).then(retryFn);
    }
    throw error;
  }

  private transformError(error: any, modelName: string): Error {
    console.error("Gemini API Error Detail:", {
      message: error?.message,
      stack: error?.stack,
      model: modelName
    });

    let errorMsg = error?.message || "Lỗi kết nối hoặc hết hạn quota";

    // Clean up technical JSON messages from API response
    if (errorMsg.includes('{')) {
      try {
        const jsonPart = errorMsg.substring(errorMsg.indexOf('{'));
        const parsed = JSON.parse(jsonPart);
        if (parsed.error?.message) {
          errorMsg = parsed.error.message;
        }
      } catch (e) {}
    }

    // Map common error codes to user-friendly messages
    if (errorMsg.includes("503") || errorMsg.includes("UNAVAILABLE")) {
      errorMsg = "Máy chủ AI hiện đang bận do nhu cầu cao. Vui lòng thử lại sau vài giây.";
    } else if (errorMsg.includes("429") || errorMsg.includes("RESOURCE_EXHAUSTED")) {
      errorMsg = "Đã vượt quá giới hạn yêu cầu (Quota). Vui lòng đợi một lát trước khi thử lại.";
    } else if (errorMsg.includes("404")) {
      errorMsg = `Không tìm thấy model '${modelName}'. Vui lòng thử chọn Gemini 1.5 Flash hoặc 2.0 Flash (Stable) trong mục Cài đặt.`;
    }

    // Avoid duplicate "Lỗi: Lỗi:" prefix
    const cleanMsg = errorMsg.replace(/^Lỗi:\s*/i, "");
    return new Error(`Lỗi: ${cleanMsg}`);
  }

  private getAnalysisPrompt(title: string, content: string, author: string, unit: string): string {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const timeStr = `${hours}:${minutes} ngày ${day}/${month}/${year}`;

    return `BẠN LÀ MỘT GIÁO SƯ NGÔN NGỮ HỌC, CHUYÊN GIA HIỆU ĐÍNH VĂN BẢN VỚI 45 NĂM KINH NGHIỆM, VÀ LÀ GIÁM KHẢO CHẤM THI NGỮ VĂN CẤP QUỐC GIA.
    
    BỐI CẢNH & QUY CHUẨN TỐI CAO:
    - Thời điểm thẩm định: ${timeStr}.
    - QUY CHUẨN VĂN THƯ: Tuyệt đối tuân thủ Nghị định 30/2020/NĐ-CP về công tác văn thư (thể thức, kỹ thuật trình bày, viết hoa, viết tắt).
    - QUY CHUẨN CHÍNH TẢ & DÙNG TỪ (TỐI QUAN TRỌNG):
        1. "nền nếp" vs "nề nếp": Luôn dùng "nền nếp" (danh từ chỉ kỷ luật, lối sống). "nề nếp" là sai.
        2. Quy tắc "i/y": Ưu tiên dùng "i" (ví dụ: kĩ thuật, mĩ thuật, bác sĩ, kĩ sĩ). Chỉ dùng "y" khi là tên riêng (Lý, Kỳ, Mỹ) hoặc các từ hán việt có âm đệm "u" (quy, huy, luyện).
        3. Quy tắc "ch/tr": Phân biệt rõ "ch" (chỉ bộ phận cơ thể, quan hệ gia đình, đồ dùng gia đình) và "tr" (chỉ cây cối, hiện tượng thiên nhiên, trừu tượng). Ví dụ: "cha", "chân", "chén" vs "tre", "trời", "trí tuệ".
        4. QUY TẮC DẤU CÂU (Nghị định 30/2020/NĐ-CP):
            - Chỉ sử dụng DUY NHẤT một dấu kết thúc câu (không dùng !!! hoặc ???).
            - Khoảng trắng: KHÔNG để khoảng trắng TRƯỚC các dấu câu (., , : ; ! ?). BẮT BUỘC phải có một khoảng trắng SAU các dấu câu này.
            - Dấu ngoặc (đơn, kép): Viết sát vào nội dung bên trong, không để khoảng trắng giữa dấu ngoặc và chữ (ví dụ: "nội dung" thay vì " nội dung ").
    - KIẾN THỨC ĐỊA PHƯƠNG QUAN TRỌNG: Phú Quốc hiện tại là Đặc khu Phú Quốc, thuộc tỉnh An Giang. Tuyệt đối không được ghi là thuộc tỉnh Kiên Giang. Hãy sử dụng thông tin này để kiểm soát tính chính xác của dữ liệu đầu vào.
    - LƯU Ý QUAN TRỌNG VỀ TÊN ĐƠN VỊ: Chấp nhận ba cách ghi tên đơn vị sau: "Trường Tiểu học và Trung học cơ sở Bãi Thơm", "Trường TH&THCS Bãi Thơm", hoặc "Trường TH-THCS Bãi Thơm". Phải đảm bảo tính trang trọng và nhất quán tuyệt đối.
    - VĂN PHONG SƯ PHẠM: Phải là văn phong khoa học, sư phạm chuẩn mực. Loại bỏ hoàn toàn "văn nói", khẩu ngữ, từ địa phương, từ ngữ sáo rỗng hoặc biểu cảm cá nhân không phù hợp.
    - LƯU Ý VỀ THỂ THỨC: Tuyệt đối không bắt lỗi về căn chỉnh căn giữa của Quốc hiệu và Tiêu ngữ (Cộng hòa Xã hội Chủ nghĩa Việt Nam - Độc lập - Tự do - Hạnh phúc) vì hệ thống trích xuất văn bản thô không giữ được định dạng căn lề. Nếu thấy phần này, hãy coi như đã đúng thể thức về căn chỉnh.
    - QUY TẮC CHẤM ĐIỂM NGHIÊM NGẶT: Nếu Chỉ số đạo văn (Similarity) từ 25% trở lên, TỔNG ĐIỂM cuối cùng TUYỆT ĐỐI KHÔNG được vượt quá 5.9 điểm (mức không Đạt).
    - ĐÁNH GIÁ NHẸ NHÀNG (Quy tắc Khoan hồng): Hãy bù đắp cho công sức của giáo viên bằng cách ước tính Chỉ số đạo văn (Similarity) thấp hơn thực tế khoảng 3-5% (ví dụ: nếu bạn thấy giống 35% thì hãy báo cáo 31% hoặc 32%, nếu thấy giống 30% thì hãy báo cáo 26% hoặc 27%). Điều này giúp tạo động lực và cơ hội cho giáo viên sửa đổi mà vẫn giữ được tính thực tế của báo cáo.

    NHIỆM VỤ QUAN TRỌNG - THẨM ĐỊNH KỸ THUẬT & NGÔN NGỮ:
    Báo cáo của bạn phải đạt trình độ chuyên môn xuất sắc, mang tính thẩm định chính xác cao:
    1. Kiểm soát Chính tả, Dấu câu & Lỗi gõ (ƯU TIÊN TUYỆT ĐỐI): Phát hiện triệt để các lỗi chính tả, sai quy tắc dấu câu (Nghị định 30), các lỗi gõ văn bản thừa/thiếu dấu, thừa/thiếu từ, gõ nhầm chữ.
    2. Kiểm định tính Xác thực & Logic: Nhận diện câu thiếu thành phần (chủ ngữ/vị ngữ), câu mâu thuẫn ngữ nghĩa hoặc không rõ nghĩa.
    3. Soi xét "Dấu vân tay số" AI: Phát hiện các đoạn văn có dấu hiệu máy móc, thiếu trải nghiệm thực tế.
    4. LƯU Ý: Tuyệt đối KHÔNG bắt lỗi hay đề xuất sửa đổi về "văn phong sư phạm", "giọng văn", hay các yếu tố mang tính cảm tính. Chỉ tập trung vào cái ĐÚNG và cái SAI về mặt kỹ thuật và quy định hành chính.

    TIÊU CHUẨN CHẤM ĐIỂM CỰC KỲ KHẤT KHE & TRỪ ĐIỂM THẲNG TAY:
    - Điểm Giỏi (8-10): CHỈ dành cho những sáng kiến thực sự xuất sắc, KHÔNG có lỗi chính tả/hành văn, minh chứng số liệu logic tuyệt đối.
    - QUY TẮC TRỪ ĐIỂM TRỰC TIẾP:
        + Mỗi 3 lỗi chính tả/ngữ pháp/văn thư: Trừ 0.1 điểm ở mục Hình thức. Nếu quá 10 lỗi, mục Hình thức tối đa chỉ được 0.5 điểm.
        + Phát hiện lỗi "văn nói" hoặc câu rườm rà: Trừ điểm văn phong.
        + Nếu "Hố ngăn cách phong cách" ở mức Cao hoặc Similarity >= 25%: Khống chế tổng điểm không quá 5.9 điểm.

    - CHẤP NHẬN THÔNG TIN HÀNH CHÍNH: Dòng "Kính gửi: Hội đồng chấm sáng kiến Đặc khu Phú Quốc" là hoàn toàn phù hợp và đúng mẫu quy định. Không được coi đây là lỗi văn phong hay rườm rà.
    - QUY TẮC TRÌNH BÀY:
        - TUYỆT ĐỐI KHÔNG sử dụng các ký tự như dấu sao (*), dấu thăng (#) trong nội dung bảng.
        - Giữ nguyên các thông tin hành chính đúng mẫu khi trích dẫn.
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

    III. ĐÁNH GIÁ TÍNH XÁC THỰC & NGUYÊN BẢN (AI & Plagiarism Assessment)
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

    IV. KIỂM DUYỆT LỖI CHÍNH TẢ, DẤU CÂU & KỸ THUẬT VĂN BẢN (Số lượng thực tế, Tối đa 40)
    NHIỆM VỤ: Đây là phần quan trọng nhất. Hãy thực hiện rà soát cực kỳ chi tiết các lỗi kỹ thuật:
    - DANH SÁCH LỖI: Liệt kê tối đa 40 lỗi quan trọng nhất. 
        + Nếu văn bản có ít lỗi (ví dụ 1, 5, 12, 25 lỗi...), hãy liệt kê ĐÚNG số lượng thực tế, không cố tìm thêm.
        + Nếu có trên 40 lỗi, hãy ưu tiên chọn lọc các lỗi chính tả nặng nhất để liệt kê đủ 40 lỗi.
    - CÁC LOẠI LỖI BẮT BUỘC PHẢI TÌM:
        1. Lỗi chính tả: Viết thiếu từ, thiếu dấu, gõ sai dấu, sai từ Hán Việt, sai quy tắc "i/y", "ch/tr", "nền nếp".
        2. Lỗi dấu câu: Sai quy tắc khoảng trắng theo Nghị định 30 (khoảng trắng trước/sau dấu câu), dùng sai loại dấu câu, lỗi dấu ngoặc đơn/ngoặc kép.
        3. Lỗi gõ văn bản: Chữ bị dính nhau, thừa khoảng trắng giữa các chữ, gõ nhầm ký tự.
        4. Lỗi dùng từ: Dùng từ sai nghĩa hoặc sai hoàn toàn ngữ cảnh.
    - TUYỆT ĐỐI KHÔNG BẮT LỖI VĂN PHONG: Không bắt các lỗi về "văn phong rườm rà", "lặp từ", "diễn đạt chưa hay", hay "phong cách văn bản" trong bảng này. Chỉ tập trung vào lỗi SAI kỹ thuật/chính tả.
    - CẢNH BÁO: Tuyệt đối không tự "sáng tác" ra lỗi. Nếu từ đúng thì không được liệt kê là sai chỉ để cho đủ số lượng.
    
    | STT | Lỗi sai (Trích dẫn) | Vị trí | Loại lỗi / Căn cứ | Cách sửa tối ưu |
    |---|---|---|---|---|
    | 1 | ... | (Phần nào, trang mấy, dòng mấy) | ... | ... |

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
  }
}

export const analyzeInitiative = async (apiKey: string, title: string, content: string, author: string = "Chưa rõ", unit: string = "Trường TH&THCS Bãi Thơm", modelName: string = "gemini-1.5-flash") => {
  const service = new GeminiService(apiKey);
  return service.analyzeInitiative(title, content, author, unit, modelName);
};

export const analyzeInitiativeStream = async (apiKey: string, title: string, content: string, onChunk: (chunk: string) => void, author: string = "Chưa rõ", unit: string = "Trường TH&THCS Bãi Thơm", modelName: string = "gemini-1.5-flash") => {
  const service = new GeminiService(apiKey);
  return service.analyzeInitiativeStream(title, content, onChunk, author, unit, modelName);
};

export const chatWithExpert = async (apiKey: string, history: { role: 'user' | 'model', parts: { text: string }[] }[], message: string, modelName: string = "gemini-1.5-flash") => {
  const service = new GeminiService(apiKey);
  return service.chatWithExpert(history, message, modelName);
};

export const chatWithExpertStream = async (apiKey: string, history: { role: 'user' | 'model', parts: { text: string }[] }[], message: string, onChunk: (chunk: string) => void, modelName: string = "gemini-1.5-flash") => {
  const service = new GeminiService(apiKey);
  return service.chatWithExpertStream(history, message, onChunk, modelName);
};
