// 시도별 에어코리아 대기오염 정보를 안전하게 전달하는 Vercel 서버리스 함수입니다.
const API_URL = "https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getCtprvnRltmMesureDnsty";

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ message: "GET 요청만 지원합니다." });
  }

  const serviceKey = process.env.AIRKOREA_KEY;
  if (!serviceKey) {
    return res.status(500).json({ message: "서버 환경변수 AIRKOREA_KEY가 설정되지 않았습니다." });
  }

  const requestedRegion = req.query?.sido;
  const sido = typeof requestedRegion === "string" && requestedRegion.trim()
    ? requestedRegion.trim()
    : "서울";
  const url = `${API_URL}?serviceKey=${encodeURIComponent(serviceKey)}&returnType=json&sidoName=${encodeURIComponent(sido)}&numOfRows=100&pageNo=1&ver=1.3`;

  let upstream;
  let result;
  try {
    upstream = await fetch(url);
    const responseText = await upstream.text();
    try {
      result = JSON.parse(responseText);
    } catch {
      return res.status(502).json({ message: "인증키 또는 요청값을 확인해주세요" });
    }
  } catch {
    return res.status(502).json({ message: "에어코리아 API 호출에 실패했습니다." });
  }

  const resultCode = result?.response?.header?.resultCode;
  if (!upstream.ok || resultCode !== "00") {
    return res.status(502).json({ message: "에어코리아 요청에 실패했습니다. 인증키 또는 요청값을 확인해주세요" });
  }

  return res.status(200).json(result);
};
