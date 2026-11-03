// Vercel 서버리스 API에서 받은 에어코리아 정보를 화면에 표시합니다.
const regionSelect = document.querySelector("#region-select");
const selectedRegion = document.querySelector("#selected-region");
const averageValue = document.querySelector("#average-value");
const averageDescription = document.querySelector("#average-description");
const stationCount = document.querySelector("#station-count");
const statusMessage = document.querySelector("#status-message");
const stationList = document.querySelector("#station-list");

const gradeDetails = {
  "1": { label: "좋음", className: "grade-1" },
  "2": { label: "보통", className: "grade-2" },
  "3": { label: "나쁨", className: "grade-3" },
  "4": { label: "매우 나쁨", className: "grade-4" },
};

function showStatus(message) {
  statusMessage.textContent = message;
  statusMessage.hidden = false;
}

function formatMeasurement(value) {
  if (value === "-" || value === null || value === undefined || String(value).trim() === "") {
    return "측정 안 됨";
  }
  return String(value);
}

function numericMeasurement(value) {
  if (value === "-" || value === null || value === undefined || String(value).trim() === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function createStationCard(station) {
  const grade = gradeDetails[String(station.pm10Grade || "").trim()];
  const card = document.createElement("article");
  card.className = `station-card ${grade ? grade.className : "grade-unknown"}`;

  const topLine = document.createElement("div");
  topLine.className = "card-topline";
  const name = document.createElement("h3");
  name.className = "station-name";
  name.textContent = station.stationName || "이름 없는 측정소";
  const badge = document.createElement("span");
  badge.className = "grade-badge";
  badge.textContent = grade ? grade.label : "등급 정보 없음";
  topLine.append(name, badge);

  const measurements = document.createElement("div");
  measurements.className = "measurements";
  measurements.append(
    createMeasurement("미세먼지", station.pm10Value),
    createMeasurement("초미세먼지", station.pm25Value),
  );

  const measuredAt = document.createElement("p");
  measuredAt.className = "measured-at";
  measuredAt.textContent = `측정 시각 · ${station.dataTime || "정보 없음"}`;
  card.append(topLine, measurements, measuredAt);
  return card;
}

function createMeasurement(label, value) {
  const wrapper = document.createElement("div");
  wrapper.className = "measurement";
  const measurementLabel = document.createElement("span");
  measurementLabel.className = "measurement-label";
  measurementLabel.textContent = label;
  const measurementValue = document.createElement("strong");
  measurementValue.className = "measurement-value";
  measurementValue.textContent = formatMeasurement(value);

  if (measurementValue.textContent !== "측정 안 됨") {
    const unit = document.createElement("small");
    unit.textContent = "㎍/㎥";
    measurementValue.append(unit);
  }

  wrapper.append(measurementLabel, measurementValue);
  return wrapper;
}

function updateAverage(stations) {
  const values = stations
    .map((station) => numericMeasurement(station.pm10Value))
    .filter((value) => value !== null);

  if (values.length === 0) {
    averageValue.textContent = "측정 안 됨";
    averageDescription.textContent = "평균을 계산할 수 있는 측정값이 없습니다.";
    return;
  }

  const average = values.reduce((total, value) => total + value, 0) / values.length;
  averageValue.textContent = Number.isInteger(average) ? String(average) : average.toFixed(1);
  averageDescription.textContent = `측정값 ${values.length}개 기준 · 값이 없는 측정소는 평균에서 제외했습니다.`;
}

async function loadAirQuality(region) {
  selectedRegion.textContent = region;
  averageValue.textContent = "불러오는 중";
  averageDescription.textContent = "측정소 자료를 불러오고 있습니다.";
  stationCount.textContent = "";
  stationList.replaceChildren();
  showStatus("자료를 불러오고 있습니다.");

  try {
    const response = await fetch(`/api/dust?sido=${encodeURIComponent(region)}`);
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result?.message || `서버 응답 오류 (${response.status})`);
    }

    const body = result?.response?.body;
    if (result?.response?.header?.resultCode !== "00") {
      const message = result?.message || "API 요청에 실패했습니다.";
      throw new Error(message);
    }

    const stations = Array.isArray(body?.items) ? body.items : [];
    updateAverage(stations);
    stationCount.textContent = `총 ${stations.length}개 측정소`;
    if (stations.length === 0) {
      showStatus("선택한 지역의 측정소 자료가 없습니다.");
      return;
    }

    statusMessage.hidden = true;
    const cards = document.createDocumentFragment();
    stations.forEach((station) => cards.append(createStationCard(station)));
    stationList.append(cards);
  } catch (error) {
    averageValue.textContent = "확인 불가";
    averageDescription.textContent = "대기질 정보를 가져오지 못했습니다.";
    showStatus(`자료를 불러오지 못했습니다. ${error.message}`);
  }
}

regionSelect.addEventListener("change", (event) => {
  loadAirQuality(event.target.value);
});

loadAirQuality(regionSelect.value);
